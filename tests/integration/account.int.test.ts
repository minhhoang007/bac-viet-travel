import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sessions } from "@/core/auth/schema";
import { users } from "@/core/users/schema";
import { notes } from "@/product/_example-notes/schema";
import { resetDb, testDb } from "./setup/db";
import { signIn, testApp } from "./setup/app";

const handle = testDb();
const t = testApp(handle.db);

beforeEach(() => resetDb(handle.db));
afterAll(() => handle.close());

describe("account data lifecycle", () => {
  it("export contains the profile and product data of that user only", async () => {
    const a = await t.app.auth.requireUser(await signIn(t, "a@example.com"));
    const b = await t.app.auth.requireUser(await signIn(t, "b@example.com"));
    await t.app.product.notes.create(a.id, { title: "Mine" });
    await t.app.product.notes.create(b.id, { title: "Theirs" });

    const data = await t.app.account.exportAccount(a.id);
    expect(data.user).toMatchObject({ id: a.id, email: "a@example.com" });
    expect(data.notes).toEqual([expect.objectContaining({ title: "Mine" })]);
    expect(JSON.stringify(data)).not.toContain("Theirs");
    expect(JSON.stringify(data)).not.toMatch(/token|password/i);
  });

  it("delete removes the user, sessions and owned rows, and signs them out", async () => {
    const headers = await signIn(t, "gone@example.com");
    const user = await t.app.auth.requireUser(headers);
    await t.app.product.notes.create(user.id, { title: "Bye" });

    await t.app.account.deleteAccount(user.id);

    expect(await handle.db.select().from(users).where(eq(users.id, user.id))).toEqual([]);
    expect(await handle.db.select().from(sessions).where(eq(sessions.userId, user.id))).toEqual([]);
    expect(await handle.db.select().from(notes).where(eq(notes.ownerId, user.id))).toEqual([]);
    expect(await t.app.auth.getUser(headers)).toBeNull();
  });
});
