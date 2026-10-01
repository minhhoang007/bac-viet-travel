import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { resetDb, testDb } from "./setup/db";
import { signIn, testApp } from "./setup/app";

const handle = testDb();
const db = handle.db;
const t = testApp(db, { saas: true, modules: { admin: true }, env: { POLAR_PRODUCT_PRO_MONTHLY: "m", POLAR_PRODUCT_PRO_YEARLY: "y" } });
const admin = t.container.admin!;
const jobs = t.container.jobs!;

async function makeUser(email: string, role: "user" | "admin" = "user") {
  const [u] = await db.insert(users).values({ email, role }).returning();
  return { id: u!.id, email };
}

beforeEach(() => resetDb(db));
afterAll(() => handle.close());

describe("admin: users", () => {
  it("lists and searches users; LIKE wildcards in the query are literal", async () => {
    await makeUser("an@example.com");
    await makeUser("binh@example.com");
    await makeUser("a_b@example.com");
    expect((await admin.listUsers()).total).toBe(3);
    expect((await admin.listUsers({ query: "binh" })).rows.map((r) => r.email)).toEqual(["binh@example.com"]);
    expect((await admin.listUsers({ query: "_" })).rows.map((r) => r.email)).toEqual(["a_b@example.com"]);
  });

  it("disabling ends the user's sessions and writes one audit entry", async () => {
    const actor = await makeUser("root@example.com", "admin");
    const headers = await signIn(t, "victim@example.com");
    const [victim] = await db.select().from(users).where(eq(users.email, "victim@example.com"));
    expect(await t.app.auth.getUser(headers)).not.toBeNull();

    await admin.setUserStatus(actor, victim!.id, "disabled");
    await admin.setUserStatus(actor, victim!.id, "disabled"); // no change → no second entry
    expect(await t.app.auth.getUser(headers)).toBeNull();

    const audit = await admin.listAudit();
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({ actorEmail: "root@example.com", action: "user.disable", targetType: "user", targetId: victim!.id });

    await admin.setUserStatus(actor, victim!.id, "active");
    expect((await admin.listAudit()).rows.map((r) => r.action)).toEqual(["user.enable", "user.disable"]);
  });

  it("role changes are audited with before/after", async () => {
    const actor = await makeUser("root@example.com", "admin");
    const u = await makeUser("u@example.com");
    await admin.setUserRole(actor, u.id, "admin");
    expect((await admin.getUser(u.id))?.role).toBe("admin");
    expect((await admin.listAudit({ targetId: u.id })).rows[0]).toMatchObject({ action: "user.set_role", metadata: { from: "user", to: "admin" } });
  });

  it("an admin cannot disable or demote themselves", async () => {
    const actor = await makeUser("root@example.com", "admin");
    await expect(admin.setUserStatus(actor, actor.id, "disabled")).rejects.toMatchObject({ code: "PERMISSION_ERROR" });
    await expect(admin.setUserRole(actor, actor.id, "user")).rejects.toMatchObject({ code: "PERMISSION_ERROR" });
    expect((await admin.listAudit()).total).toBe(0);
  });

  it("the audit trail survives deleting the acting admin", async () => {
    const actor = await makeUser("root@example.com", "admin");
    const u = await makeUser("u@example.com");
    await admin.setUserRole(actor, u.id, "admin");
    await t.app.account.deleteAccount(actor.id);
    expect((await admin.listAudit()).rows[0]).toMatchObject({ actorId: null, actorEmail: "root@example.com" });
  });
});

describe("admin: module actions", () => {
  it("retrying a dead job is audited; a non-retryable job writes nothing", async () => {
    const actor = await makeUser("root@example.com", "admin");
    await jobs.enqueue("unknown.job", {}, { maxAttempts: 1 });
    await jobs.runDue();
    const [dead] = await jobs.list({ statuses: ["dead"] });
    expect(dead).toBeDefined();

    const entry = { action: "job.retry", targetType: "job", targetId: dead!.id };
    expect(await admin.audited(actor, entry, () => jobs.retry(dead!.id))).toBe(true);
    expect((await jobs.list({ statuses: ["queued"] })).map((j) => j.id)).toEqual([dead!.id]);
    expect(await admin.audited(actor, entry, () => jobs.retry(dead!.id))).toBe(false);
    expect((await admin.listAudit()).total).toBe(1);
  });

  it("signups per day include empty days", async () => {
    await makeUser("a@example.com");
    const days = await admin.signupsByDay(7);
    expect(days).toHaveLength(7);
    expect(days.at(-1)?.count).toBe(1);
    expect(days.slice(0, 6).every((d) => d.count === 0)).toBe(true);
  });
});
