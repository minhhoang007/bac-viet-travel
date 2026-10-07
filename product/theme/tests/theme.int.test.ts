import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { testApp } from "@/tests/integration/setup/app";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { DEFAULT_THEME } from "../themes";

const { db, close } = testDb();
const { container } = testApp(db, { modules: { admin: true } });
const { theme } = container.app!.product;

let admin: { id: string; email: string };

beforeEach(async () => {
  await resetDb(db);
  await db.execute(sql`TRUNCATE site_settings`);
  const [a] = await db.insert(users).values({ email: "boss@example.com", role: "admin" }).returning();
  admin = { id: a!.id, email: a!.email };
});
afterAll(() => close());

describe("site theme setting", () => {
  it("default until an admin saves one; saving again replaces it; each save is audited", async () => {
    expect(await theme.get()).toEqual(DEFAULT_THEME);
    await theme.set(admin, { theme: "paper", mode: "light" });
    expect(await theme.get()).toEqual({ theme: "paper", mode: "light" });
    await theme.set(admin, { theme: "jade", mode: "auto" });
    expect(await theme.get()).toEqual({ theme: "jade", mode: "auto" });

    const { rows } = await container.admin!.listAudit({ targetId: "theme" });
    expect(rows.map((r) => [r.action, r.actorEmail])).toEqual([
      ["theme.set", "boss@example.com"],
      ["theme.set", "boss@example.com"],
    ]);
  });

  it("a stored value it does not know reads as the default", async () => {
    await db.execute(sql`INSERT INTO site_settings (key, value) VALUES ('theme', '{"theme":"neon"}'::jsonb)`);
    expect(await theme.get()).toEqual(DEFAULT_THEME);
  });
});
