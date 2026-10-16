// Adds the shape (`ar=W:H`) to Unsplash photos inside posts written before picks carried it, so pages keep each
// image's space before it loads (no layout shift). Both the working copy and the live copy of every post; only the
// image URLs change. Sizes come from Unsplash's CDN metadata (no API key). Live pages show it within the hour.
// Usage (dry run first, then --apply):
//   DATABASE_URL=... pnpm blog:ratios
//   DATABASE_URL=... pnpm blog:ratios --apply
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { contentItems } from "@/modules/content/schema";
import { missingRatios, unsplashSize, withRatios } from "@/product/media/unsplash-ratio";

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Usage: DATABASE_URL=... pnpm blog:ratios [--apply]");
  process.exit(1);
}

const { db, close } = createDb(url);
try {
  const posts = await db.select().from(contentItems).where(eq(contentItems.type, "post"));
  const body = (data: Record<string, unknown> | null) => (typeof data?.body === "string" ? data.body : "");
  const wanted = [...new Set(posts.flatMap((p) => [...missingRatios(body(p.draft)), ...missingRatios(body(p.published))]))];
  console.log(`${posts.length} posts, ${wanted.length} Unsplash images without a shape.`);

  const sizes = new Map<string, { width: number; height: number }>();
  for (const src of wanted) {
    const size = await unsplashSize(src);
    if (size) sizes.set(src, size);
    else console.warn(`  size unknown, left as is: ${src}`);
  }

  let changed = 0;
  for (const p of posts) {
    const draft = withRatios(body(p.draft), sizes);
    const published = p.published ? withRatios(body(p.published), sizes) : null;
    if (draft === body(p.draft) && (published === null || published === body(p.published))) continue;
    changed++;
    console.log(`  ${apply ? "updated" : "would update"}: ${p.slug}`);
    if (apply) {
      await db
        .update(contentItems)
        .set({ draft: { ...p.draft, body: draft }, ...(p.published && published !== null ? { published: { ...p.published, body: published } } : {}) })
        .where(eq(contentItems.id, p.id));
    }
  }
  console.log(apply ? `Done: ${changed} posts updated.` : `Dry run: ${changed} posts would change. Run again with --apply.`);
} finally {
  await close();
}
