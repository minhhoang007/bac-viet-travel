// Imports the MDX posts (blogConfig.dir) into the content module as published posts, for blog source "content".
// Idempotent: a post whose slug already exists is skipped, so it never overwrites what editors changed in the admin.
// Usage (dry run first, then --apply):
//   pnpm blog:import --as admin@example.com
//   pnpm blog:import --as admin@example.com --apply
// --as: an existing admin, recorded as author of the versions. --create-actor: test databases only (name contains
// "e2e" or "test"), creates that admin first. Drafts (draft: true) are imported as drafts, not published.
import { eq } from "drizzle-orm";
import { createLogger } from "@/core/logger";
import { users } from "@/core/users/schema";
import { createDb } from "@/db/client";
import { createBlog, type Post } from "@/modules/blog";
import { createContentModule } from "@/modules/content";
import { appConfig } from "@/config/app";
import { blogConfig } from "@/config/blog";

const POST = "post";
const args = process.argv.slice(2);
const asFlag = args.indexOf("--as");
const email = asFlag >= 0 ? args[asFlag + 1]?.trim().toLowerCase() : undefined;
const apply = args.includes("--apply");
const createActor = args.includes("--create-actor");
const url = process.env.DATABASE_URL;
if (!url || !email) {
  console.error("Usage: DATABASE_URL=... pnpm blog:import --as <admin email> [--apply]");
  process.exit(1);
}
const dbName = new URL(url).pathname.slice(1);
if (createActor && !/e2e|test/i.test(dbName)) {
  console.error(`--create-actor is for test databases only (got "${dbName}").`);
  process.exit(1);
}

/** Admin posts render as Markdown + <Callout> (no code): other MDX tags would show as text. */
const otherTags = (body: string) => [...new Set([...body.matchAll(/<([A-Z][A-Za-z]*)/g)].map((m) => m[1]!))].filter((t) => t !== "Callout");

const toData = ({ title, description, date, updated, tags, cover, author, translationKey, locale, body }: Post) => ({
  title,
  description,
  date,
  ...(updated ? { updated } : {}),
  tags,
  ...(cover ? { cover } : {}),
  ...(author ? { author } : {}),
  ...(translationKey ? { translationKey } : {}),
  locale,
  body: body.trim(),
});

const { db, close } = createDb(url, { max: 1 });
try {
  let [actor] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email));
  if (!actor && createActor && apply) [actor] = await db.insert(users).values({ email, role: "admin", emailVerified: true }).returning({ id: users.id, role: users.role });
  if (!actor || actor.role !== "admin") {
    console.error(`${email} must be an existing admin (sign in once, then pnpm admin:grant ${email}).`);
    process.exitCode = 1;
  } else {
    const content = createContentModule({ db, logger: createLogger({ write: () => {} }), types: [POST], adminUrl: () => "" });
    const blog = createBlog({ dir: blogConfig.dir, locales: appConfig.locales, postsPerPage: 1000, includeDrafts: true, wordsPerMinute: blogConfig.wordsPerMinute });
    const existing = new Set((await content.list({ type: POST, pageSize: 100 })).rows.map((r) => r.slug));
    let imported = 0;
    for (const locale of appConfig.locales) {
      for (const summary of blog.list(locale)) {
        const post = blog.get(locale, summary.slug)!;
        if (existing.has(post.slug)) {
          console.log(`skip     ${locale}/${post.slug} (slug already in the CMS)`);
          continue;
        }
        const tags = otherTags(post.body);
        if (tags.length) console.warn(`warning  ${locale}/${post.slug}: <${tags.join(">, <")}> will show as text (only <Callout> is kept)`);
        if (!apply) {
          console.log(`would import ${locale}/${post.slug} (${post.title})${post.draft ? " as a draft" : ""}`);
          continue;
        }
        const item = await content.create(actor, { type: POST, slug: post.slug, data: toData(post) });
        if (!post.draft) await content.approve(actor, item.id, { revision: item.revision });
        existing.add(post.slug);
        imported++;
        console.log(`imported ${locale}/${post.slug}${post.draft ? " (draft)" : " (published)"}`);
      }
    }
    console.log(apply ? `Done: ${imported} imported.` : "Dry run: nothing written. Add --apply to import.");
  }
} finally {
  await close();
}
