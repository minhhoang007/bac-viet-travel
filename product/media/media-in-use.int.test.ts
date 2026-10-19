import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { MediaProvider } from "@/modules/media";
import { contentItems } from "@/modules/content/schema";
import { mediaAssets } from "@/modules/media/schema";
import { testApp } from "@/tests/integration/setup/app";
import { resetDb, testDb } from "@/tests/integration/setup/db";

// The media module as bootstrap builds it: the manifest's `mediaInUse` must reach `remove`.
const { db, close } = testDb();
const destroyed: string[] = [];
const provider: MediaProvider = {
  origins: { upload: "https://upload.test", images: "https://img.test" },
  signUpload: () => ({ url: "https://upload.test", fields: {} }),
  fetch: async () => null,
  destroy: async (publicId) => void destroyed.push(publicId),
  url: (image) => `https://img.test/${image.publicId}`,
};
const { container } = testApp(db, {
  modules: { admin: true, media: true },
  env: { CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s" },
  overrides: { mediaProvider: provider },
});
const media = container.media!;

async function asset(publicId: string) {
  const [row] = await db.insert(mediaAssets).values({ publicId, name: "x.jpg", status: "ready", width: 10, height: 10, format: "jpg", bytes: 1, version: 1 }).returning();
  return row!;
}

beforeEach(async () => {
  await resetDb(db);
  destroyed.length = 0;
});
afterAll(() => close());

describe("media in use (wired through the container)", () => {
  it("refuses to delete an image a tour draft or a live post refers to; deletes an unused one", async () => {
    const byId = await asset("site/tour-cover");
    const byUrl = await asset("site/post-photo");
    const unused = await asset("site/unused");
    await db.insert(contentItems).values([
      { type: "tour", slug: "ha-giang", draft: { shared: { images: [{ mediaId: byId.id }] } } },
      { type: "post", slug: "tips", draft: { body: "" }, published: { body: `![](https://img.test/f_auto/v1/${byUrl.publicId}.jpg)` } },
    ]);

    await expect(media.remove(byId.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(media.remove(byUrl.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await media.remove(unused.id);
    expect(destroyed).toEqual([unused.publicId]);
  });
});
