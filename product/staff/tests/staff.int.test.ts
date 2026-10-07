import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { testApp } from "@/tests/integration/setup/app";
import { resetDb, testDb } from "@/tests/integration/setup/db";

const { db, close } = testDb();
const { container } = testApp(db, { modules: { admin: true } });
const { staff } = container.app!.product;

let admin: { id: string; email: string };
let seller: { id: string; email: string };

beforeEach(async () => {
  await resetDb(db);
  await db.execute(sql`TRUNCATE staff_roles`);
  const [a] = await db.insert(users).values({ email: "boss@example.com", role: "admin" }).returning();
  const [s] = await db.insert(users).values({ email: "sale@example.com", role: "editor" }).returning();
  admin = { id: a!.id, email: a!.email };
  seller = { id: s!.id, email: s!.email };
});
afterAll(() => close());

describe("staff roles (H2)", () => {
  it("give, change and remove a role; each change is audited", async () => {
    expect(await staff.roleOf(seller.id)).toBeNull();
    await staff.set(admin, seller.id, "sale");
    expect(await staff.roleOf(seller.id)).toBe("sale");
    await staff.set(admin, seller.id, "manager");
    expect(await staff.roleOf(seller.id)).toBe("manager");
    expect((await staff.list()).map((r) => [r.userId, r.role])).toEqual([[seller.id, "manager"]]);
    await staff.set(admin, seller.id, null);
    expect(await staff.roleOf(seller.id)).toBeNull();

    const { rows } = await container.admin!.listAudit({ targetId: seller.id });
    expect(rows.map((r) => [r.action, r.actorEmail]).sort()).toEqual([
      ["staff.remove", "boss@example.com"],
      ["staff.role", "boss@example.com"],
      ["staff.role", "boss@example.com"],
    ]);
  });
});
