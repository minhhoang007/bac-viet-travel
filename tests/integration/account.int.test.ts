import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAccountService } from "@/core/account";
import { sessions } from "@/core/auth/schema";
import { users } from "@/core/users/schema";
import { resetDb, testDb } from "./setup/db";
import { signIn, testApp } from "./setup/app";

// Core account lifecycle, independent of product code (product exporters are tested with the product).
const handle = testDb();
const t = testApp(handle.db);

beforeEach(() => resetDb(handle.db));
afterAll(() => handle.close());

describe("account data lifecycle", () => {
  it("export contains the user's profile plus every registered exporter, without secrets", async () => {
    const a = await t.app.auth.requireUser(await signIn(t, "a@example.com"));
    const account = createAccountService(handle.db, [{ name: "things", export: async (userId) => [{ userId }] }]);

    const data = await account.exportAccount(a.id);
    expect(data.user).toMatchObject({ id: a.id, email: "a@example.com" });
    expect(data.things).toEqual([{ userId: a.id }]);
    expect(JSON.stringify(data)).not.toMatch(/token|password|secret/i);
  });

  it("delete removes the user and sessions, and signs them out", async () => {
    const headers = await signIn(t, "gone@example.com");
    const user = await t.app.auth.requireUser(headers);

    await t.app.account.deleteAccount(user.id);

    expect(await handle.db.select().from(users).where(eq(users.id, user.id))).toEqual([]);
    expect(await handle.db.select().from(sessions).where(eq(sessions.userId, user.id))).toEqual([]);
    expect(await t.app.auth.getUser(headers)).toBeNull();
  });
});
