// Imports the MDX tours (content/tours) into the content module as published tours. Idempotent: a tour whose slug
// already exists is skipped, so it never overwrites what editors changed in the admin.
// Usage (dry run first, then --apply):
//   node --env-file=.env.vercel --import ./scripts/ts-alias.mjs scripts/import-tours.ts --as admin@example.com
//   node --env-file=.env.vercel --import ./scripts/ts-alias.mjs scripts/import-tours.ts --as admin@example.com --apply
// --as: an existing admin, recorded as author of the versions. --create-actor: test databases only (name contains
// "e2e" or "test"), creates that admin first.
import { eq } from "drizzle-orm";
import { createLogger } from "@/core/logger";
import { users } from "@/core/users/schema";
import { createDb } from "@/db/client";
import { createContentModule } from "@/modules/content";
import { getTourCatalog } from "@/product/tours/catalog";
import { fromMdxTours } from "@/product/tours/document";
import { TOUR_CONTENT_TYPE } from "@/product/tours/source";

const args = process.argv.slice(2);
const asFlag = args.indexOf("--as");
const email = asFlag >= 0 ? args[asFlag + 1]?.trim().toLowerCase() : undefined;
const apply = args.includes("--apply");
const createActor = args.includes("--create-actor");
const url = process.env.DATABASE_URL;
if (!url || !email) {
  console.error("Usage: DATABASE_URL=... node --import ./scripts/ts-alias.mjs scripts/import-tours.ts --as <admin email> [--apply]");
  process.exit(1);
}
const dbName = new URL(url).pathname.slice(1);
if (createActor && !/e2e|test/i.test(dbName)) {
  console.error(`--create-actor is for test databases only (got "${dbName}").`);
  process.exit(1);
}

const { db, close } = createDb(url, { max: 1 });
try {
  let [actor] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email));
  if (!actor && createActor && apply) [actor] = await db.insert(users).values({ email, role: "admin", emailVerified: true }).returning({ id: users.id, role: users.role });
  if (!actor || actor.role !== "admin") {
    console.error(`${email} must be an existing admin (sign in once, then pnpm admin:grant ${email}).`);
    process.exitCode = 1;
  } else {
    const content = createContentModule({ db, logger: createLogger({ write: () => {} }), types: [TOUR_CONTENT_TYPE], adminUrl: () => "" });
    const catalog = getTourCatalog();
    const existing = new Set((await content.list({ type: TOUR_CONTENT_TYPE, pageSize: 100 })).rows.map((r) => r.slug));
    let imported = 0;
    for (const slug of catalog.slugs()) {
      if (existing.has(slug)) {
        console.log(`skip     ${slug} (already in the CMS)`);
        continue;
      }
      const doc = fromMdxTours({ vi: catalog.get("vi", slug)!, en: catalog.get("en", slug)! });
      if (!apply) {
        console.log(`would import ${slug} (${doc.vi.title})`);
        continue;
      }
      const item = await content.create(actor, { type: TOUR_CONTENT_TYPE, slug, data: doc });
      await content.approve(actor, item.id, { revision: item.revision });
      imported++;
      console.log(`imported ${slug} (published)`);
    }
    console.log(apply ? `Done: ${imported} imported, ${existing.size} already present.` : "Dry run: nothing written. Add --apply to import.");
  }
} finally {
  await close();
}
