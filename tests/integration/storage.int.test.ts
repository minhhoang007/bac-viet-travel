import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { files } from "@/modules/storage/schema";
import { s3Storage } from "@/providers/storage/s3";
import { resetDb, testDb } from "./setup/db";
import { testApp } from "./setup/app";
import { ensureBucket, TEST_STORAGE } from "./setup/storage";

const handle = testDb();
const db = handle.db;
const objects = s3Storage(TEST_STORAGE);
// Storage alone (no entitlements): quota = free plan's storage.max_bytes.
const t = testApp(db, { modules: { storage: true } });
const storage = t.container.storage!;
const MB = 1024 * 1024;

async function user(email = `${crypto.randomUUID()}@example.com`) {
  const [u] = await db.insert(users).values({ email }).returning();
  return u!.id;
}

/** requestUpload → browser PUT → confirm, as the uploader component does. */
async function upload(userId: string, body: string, contentType = "text/plain", name = "a.txt") {
  const size = Buffer.byteLength(body);
  const { fileId, url, headers } = await storage.requestUpload(userId, { name, contentType, size });
  const res = await fetch(url, { method: "PUT", headers, body });
  expect(res.ok).toBe(true);
  return storage.confirmUpload(userId, fileId);
}

const keyOf = async (fileId: string) => (await db.select({ key: files.key }).from(files).where(eq(files.id, fileId)))[0]!.key;

beforeAll(() => ensureBucket());
beforeEach(() => resetDb(db));
afterAll(() => handle.close());

describe("storage: upload, download, delete", () => {
  it("full flow; download keeps the original (Vietnamese) name; delete removes the object", async () => {
    const id = await user();
    const file = await upload(id, "nội dung", "text/plain", "../../báo cáo.txt");
    expect(file).toMatchObject({ name: "báo cáo.txt", size: Buffer.byteLength("nội dung") });
    expect((await storage.list(id)).map((f) => f.id)).toEqual([file.id]);

    const res = await fetch(await storage.downloadUrl(id, file.id));
    expect(await res.text()).toBe("nội dung");
    expect(res.headers.get("content-disposition")).toContain("filename*=UTF-8''b%C3%A1o%20c%C3%A1o.txt");

    const key = await keyOf(file.id);
    expect(key).toMatch(new RegExp(`^u/${id}/[0-9a-f-]{36}$`));
    await storage.remove(id, file.id);
    expect(await objects.head(key)).toBeNull();
    expect(await storage.list(id)).toEqual([]);
  });

  it("another user cannot download or delete the file (IDOR)", async () => {
    const owner = await user();
    const other = await user();
    const file = await upload(owner, "secret");
    await expect(storage.downloadUrl(other, file.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(storage.remove(other, file.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(storage.confirmUpload(other, file.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(storage.downloadUrl(other, "not-a-uuid")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await storage.list(owner)).toHaveLength(1);
  });
});

describe("storage: validation and quota", () => {
  it("rejects disallowed types (HTML, SVG) and oversize files before issuing a URL", async () => {
    const id = await user();
    await expect(storage.requestUpload(id, { name: "x.html", contentType: "text/html", size: 10 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(storage.requestUpload(id, { name: "x.svg", contentType: "image/svg+xml", size: 10 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(storage.requestUpload(id, { name: "x.png", contentType: "image/png", size: 11 * MB })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(storage.requestUpload(id, { name: "x.png", contentType: "image/png", size: 0 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("parallel requests never exceed the quota (pending uploads count)", async () => {
    const id = await user();
    // Free quota 100 MB, 10 MB per file: 15 parallel requests → exactly 10 succeed.
    const results = await Promise.allSettled(
      Array.from({ length: 15 }, (_, i) => storage.requestUpload(id, { name: `${i}.pdf`, contentType: "application/pdf", size: 10 * MB })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.code === "QUOTA_EXCEEDED")).toBe(true);
    expect(await storage.usage(id)).toEqual({ usedBytes: 100 * MB, quotaBytes: 100 * MB });
  });

  it("confirm rejects a missing upload and frees the reservation", async () => {
    const id = await user();
    const { fileId } = await storage.requestUpload(id, { name: "a.txt", contentType: "text/plain", size: 5 });
    await expect(storage.confirmUpload(id, fileId)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await storage.usage(id)).usedBytes).toBe(0);
  });

  it("unconfirmed reservations are purged", async () => {
    const id = await user();
    await storage.requestUpload(id, { name: "a.txt", contentType: "text/plain", size: 5 });
    expect(await storage.purgePending(60)).toBe(0);
    expect(await storage.purgePending(-1)).toBe(1);
    expect((await storage.usage(id)).usedBytes).toBe(0);
  });
});

describe("storage: account lifecycle", () => {
  it("export lists the files; deleting the account deletes the objects", async () => {
    const t2 = testApp(db, { modules: { storage: true } });
    const id = await user();
    const file = await upload(id, "x");
    const key = await keyOf(file.id);
    expect((await t2.app.account.exportAccount(id)).files).toEqual([expect.objectContaining({ id: file.id, name: "a.txt" })]);
    await t2.app.account.deleteAccount(id);
    expect(await objects.head(key)).toBeNull();
  });

  it("a storage failure aborts the account deletion", async () => {
    const failing = { ...objects, delete: async () => { throw new Error("storage down"); } };
    const t2 = testApp(db, { modules: { storage: true }, overrides: { objectStorage: failing } });
    const id = await user();
    await upload(id, "x");
    await expect(t2.app.account.deleteAccount(id)).rejects.toThrow(/storage down/);
    expect(await storage.list(id)).toHaveLength(1);
  });
});
