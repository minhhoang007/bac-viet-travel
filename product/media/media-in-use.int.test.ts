import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { MediaProvider } from "@/modules/media";
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
  // Raw SQL: outside a module, only its public API may be imported (pnpm arch).
  const [row] = await db.execute<{ id: string; publicId: string }>(
    sql`insert into media_assets (public_id, name, status, width, height, format, bytes, version) values (${publicId}, 'x.jpg', 'ready', 10, 10, 'jpg', 1, 1) returning id, public_id as "publicId"`,
  );
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
    const tour = JSON.stringify({ shared: { images: [{ mediaId: byId.id }] } });
    const post = JSON.stringify({ body: `![](https://img.test/f_auto/v1/${byUrl.publicId}.jpg)` });
    await db.execute(sql`insert into content_items (type, slug, draft) values ('tour', 'ha-giang', ${tour}::jsonb)`);
    await db.execute(sql`insert into content_items (type, slug, draft, published) values ('post', 'tips', '{"body":""}'::jsonb, ${post}::jsonb)`);

    await expect(media.remove(byId.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(media.remove(byUrl.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await media.remove(unused.id);
    expect(destroyed).toEqual([unused.publicId]);
  });

  it("an image only an older saved version uses stays too (restoring it would bring the image back)", async () => {
    const old = await asset("site/old-cover");
    const version = JSON.stringify({ shared: { images: [{ mediaId: old.id }] } });
    await db.execute(sql`
      with item as (insert into content_items (type, slug, draft) values ('tour', 'sa-pa', '{}'::jsonb) returning id)
      insert into content_versions (item_id, event, slug, data) select id, 'published', 'sa-pa', ${version}::jsonb from item`);
    await expect(media.remove(old.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
