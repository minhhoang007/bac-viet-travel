import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/minh_test";

export function testDb() {
  return createDb(TEST_DATABASE_URL, { max: 5 });
}

/** Empties every app table (keeps migration journals). */
export async function resetDb(db: ReturnType<typeof testDb>["db"]) {
  await db.execute(sql`TRUNCATE users, sessions, accounts, verifications, notes RESTART IDENTITY CASCADE`);
}
