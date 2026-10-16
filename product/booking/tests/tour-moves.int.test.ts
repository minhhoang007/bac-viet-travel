import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { testApp } from "@/tests/integration/setup/app";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { contentTypes } from "../../manifest";
import { departures, discountCodes } from "../../schema/booking";

// The container as bootstrap builds it (content module on): a tour publish runs the product's onChange.
const { db, close } = testDb();
const { container } = testApp(db, { modules: { admin: true, content: true } });
const content = container.content!;

let admin: { id: string };
beforeEach(async () => {
  await resetDb(db);
  await db.execute(sql`TRUNCATE booking_payments, bookings, departures, discount_codes RESTART IDENTITY CASCADE`);
  const [a] = await db.insert(users).values({ email: "admin@example.com", role: "admin" }).returning();
  admin = { id: a!.id };
});
afterAll(() => close());

// The content module's validate (tourProblems) needs a complete tour: the test writes the published state itself.
async function publish(slug: string, id?: string) {
  const item = id ? await content.get(id) : await content.create(admin, { type: "tour", slug, data: {} });
  const saved = id ? await content.saveDraft(admin, item!.id, { revision: item!.revision, slug, data: {} }) : item!;
  await db.execute(sql`UPDATE content_items SET status = 'published', published = draft, published_slug = slug, published_at = now() WHERE id = ${saved.id}`);
  await db.execute(sql`INSERT INTO content_versions (item_id, event, slug, data) VALUES (${saved.id}, 'published', ${slug}, '{}'::jsonb)`);
  return saved.id;
}

// The product's hook after a publish; its revalidateTag needs a Next.js request and fails here (after the sync).
const published = (id: string, slug: string) => Promise.resolve(contentTypes.tour!.onChange!({ id, type: "tour", slug, publishedSlug: slug })).catch(() => {});

describe("renamed tour", () => {
  it("departures and discount codes follow the new slug; an old slug reused by another tour stays with it", async () => {
    const id = await publish("ha-long");
    await db.insert(departures).values({ tourSlug: "ha-long", date: "2026-11-01", capacity: 10 });
    await db.insert(discountCodes).values({ code: "HALONG", kind: "percent", value: 10, validFrom: "2026-10-01", validTo: "2026-12-31", tourSlug: "ha-long" });

    await publish("vinh-ha-long", id);
    await published(id, "vinh-ha-long");
    expect((await db.select().from(departures)).map((d) => d.tourSlug)).toEqual(["vinh-ha-long"]);
    expect((await db.select().from(discountCodes)).map((d) => d.tourSlug)).toEqual(["vinh-ha-long"]);

    // A new tour takes the old slug: its own dates stay its own.
    const other = await publish("ha-long");
    const [mine] = await db.insert(departures).values({ tourSlug: "ha-long", date: "2026-11-02", capacity: 10 }).returning();
    await published(other, "ha-long");
    expect((await db.select().from(departures).where(eq(departures.id, mine!.id)))[0]!.tourSlug).toBe("ha-long");
  });
});
