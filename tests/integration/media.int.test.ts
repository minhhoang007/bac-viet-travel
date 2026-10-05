import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildContainer } from "@/bootstrap/container";
import { validateEnv } from "@/bootstrap/env";
import { moduleManifests } from "@/bootstrap/modules";
import { featureDefaults } from "@/config/features.defaults";
import { mediaConfig } from "@/config/media";
import { users } from "@/core/users/schema";
import { createLogger } from "@/core/logger";
import { createMediaModule, type MediaProvider } from "@/modules/media";
import { mediaAssets } from "@/modules/media/schema";
import { resetDb, testDb } from "./setup/db";
import { testApp } from "./setup/app";

const { db, close } = testDb();
const logger = createLogger({ write: () => {} });
let clock = new Date("2026-10-05T03:00:00Z");

// Fake provider: "uploaded" holds what the browser would have sent to Cloudinary.
const uploaded = new Map<string, { width: number; height: number; format: string; bytes: number; version: number }>();
const destroyed: string[] = [];
const provider: MediaProvider = {
  origins: { upload: "https://upload.test", images: "https://img.test" },
  signUpload: ({ publicId, allowedFormats }) => ({ url: "https://upload.test", fields: { public_id: publicId, allowed_formats: allowedFormats.join(",") } }),
  fetch: async (publicId) => uploaded.get(publicId) ?? null,
  destroy: async (publicId) => void destroyed.push(publicId),
  url: (image, o = {}) => `https://img.test/${image.publicId}?w=${o.width ?? ""}&h=${o.height ?? ""}&fx=${o.focal?.x ?? ""}`,
};
let inUse = new Set<string>();
const media = createMediaModule({ db, logger, provider, config: { ...mediaConfig, folder: "test" }, inUse: async (id) => inUse.has(id), now: () => clock });

let editor: { id: string };
beforeEach(async () => {
  await resetDb(db);
  uploaded.clear();
  destroyed.length = 0;
  inUse = new Set();
  clock = new Date("2026-10-05T03:00:00Z");
  const [u] = await db.insert(users).values({ email: "editor@example.com", role: "editor" }).returning();
  editor = { id: u!.id };
});
afterAll(() => close());

async function upload(stored = { width: 1600, height: 1200, format: "jpg", bytes: 200_000, version: 3 }) {
  const signed = await media.requestUpload(editor, { name: "photos/2026/ha-long.jpg" });
  uploaded.set(signed.fields.public_id!, stored);
  return signed;
}

describe("media module", () => {
  it("signed upload → confirm reads what the provider stored; random provider id, clean file name", async () => {
    const signed = await upload();
    expect(signed.fields.public_id).toMatch(/^test\/[0-9a-f-]{36}$/);
    expect(signed.fields.allowed_formats).toBe("jpg,png,webp,avif");
    const asset = await media.confirmUpload(signed.id);
    expect(asset).toMatchObject({ width: 1600, height: 1200, format: "jpg", bytes: 200_000, version: 3, name: "ha-long.jpg" });
    expect((await media.list()).rows.map((r) => r.id)).toEqual([signed.id]);
  });

  it("rejects what the browser cannot be trusted with: missing upload, wrong format, too large (image destroyed, row gone)", async () => {
    const missing = await media.requestUpload(editor, { name: "x.jpg" });
    await expect(media.confirmUpload(missing.id)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const svg = await upload({ width: 10, height: 10, format: "svg", bytes: 10, version: 1 });
    await expect(media.confirmUpload(svg.id)).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: "Image type not allowed" });
    const big = await upload({ width: 10, height: 10, format: "png", bytes: mediaConfig.maxBytes + 1, version: 1 });
    await expect(media.confirmUpload(big.id)).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: "Image too large" });
    expect(destroyed).toEqual([svg.fields.public_id, big.fields.public_id]);
    expect(await db.select().from(mediaAssets)).toEqual([]);
  });

  it("alt text per locale and focal point (clamped to 0–1); responsive props crop around it without upscaling", async () => {
    const { id } = await upload({ width: 800, height: 600, format: "jpg", bytes: 1, version: 1 });
    await media.confirmUpload(id);
    const updated = await media.update(id, { alt: { vi: " Vịnh Hạ Long ", en: "Ha Long Bay" }, focalX: 1.7, focalY: 0.25 });
    expect(updated).toMatchObject({ alt: { vi: "Vịnh Hạ Long", en: "Ha Long Bay" }, focalX: 1, focalY: 0.25 });
    const props = media.imageProps(updated, { aspect: 16 / 9, widths: [320, 1280] });
    expect(props.srcSet).toBe(`https://img.test/${updated.publicId}?w=320&h=180&fx=1 320w, https://img.test/${updated.publicId}?w=800&h=450&fx=1 800w`);
    expect(props).toMatchObject({ width: 800, height: 450 });
  });

  it("cannot delete an image used by live content; otherwise image first, then row", async () => {
    const { id, fields } = await upload();
    await media.confirmUpload(id);
    inUse.add(id);
    await expect(media.remove(id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(destroyed).toEqual([]);
    inUse.clear();
    await media.remove(id);
    expect(destroyed).toEqual([fields.public_id]);
    expect(await media.get(id)).toBeNull();
  });

  it("purges uploads never confirmed after an hour", async () => {
    const stale = await media.requestUpload(editor, { name: "a.jpg" });
    clock = new Date(clock.getTime() + 61 * 60_000);
    await db.update(mediaAssets).set({ createdAt: new Date(clock.getTime() - 61 * 60_000) }).where(eq(mediaAssets.id, stale.id));
    const fresh = await media.requestUpload(editor, { name: "b.jpg" });
    expect(await media.purgePending()).toBe(1);
    expect((await db.select({ id: mediaAssets.id }).from(mediaAssets)).map((r) => r.id)).toEqual([fresh.id]);
  });
});

describe("media module wiring", () => {
  it("is really off by default: no env needed, no module, no purge task", () => {
    const features = { ...featureDefaults, profile: "app" as const };
    const env = validateEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000", DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "x".repeat(32) }, features, moduleManifests);
    expect(buildContainer(features, env, { db }).media).toBeUndefined();
  });

  it("on: requires admin and the Cloudinary credentials", () => {
    const features = { ...featureDefaults, profile: "app" as const, media: true };
    const base = { NEXT_PUBLIC_SITE_URL: "http://localhost:3000", DATABASE_URL: "postgres://x", BETTER_AUTH_SECRET: "x".repeat(32) };
    expect(() => validateEnv(base, features, moduleManifests)).toThrow(/admin|CLOUDINARY_CLOUD_NAME/);
    const { container } = testApp(db, { modules: { admin: true, media: true }, env: { CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s" }, overrides: { mediaProvider: provider } });
    expect(container.media?.origins).toEqual(provider.origins);
  });
});
