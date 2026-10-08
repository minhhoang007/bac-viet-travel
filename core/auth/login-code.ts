import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { verifications } from "./schema";

/**
 * A 6-digit code sent with each magic link, for signing in on another device than the one reading the email.
 * The code stands for the link: entering it opens the same one-time link (which Better Auth then consumes). Stored
 * hashed, 10 minutes, at most MAX_ATTEMPTS wrong tries before it is dropped.
 */
const MAX_ATTEMPTS = 5;
const TTL_MS = 10 * 60_000;
const identifier = (email: string) => `login-code:${email.trim().toLowerCase()}`;

interface Stored {
  hash: string;
  link: string;
  attempts: number;
}

export function createLoginCodes(deps: { db: Db; secret: string; now?: () => Date }) {
  const now = () => deps.now?.() ?? new Date();
  const hash = (email: string, code: string) => createHmac("sha256", deps.secret).update(`${identifier(email)}:${code}`).digest("base64url");

  return {
    /** A new code for this email and link (replaces any earlier one). */
    async issue(email: string, link: string): Promise<string> {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const value: Stored = { hash: hash(email, code), link, attempts: 0 };
      await deps.db.delete(verifications).where(eq(verifications.identifier, identifier(email)));
      await deps.db.insert(verifications).values({ identifier: identifier(email), value: JSON.stringify(value), expiresAt: new Date(now().getTime() + TTL_MS) });
      return code;
    },

    /**
     * The link the code stands for (once), or null: unknown, expired, wrong (counts an attempt) or used up. The row
     * is locked while it is checked, so guesses sent at the same time are counted one after another (never more
     * than MAX_ATTEMPTS checks in all).
     */
    async redeem(email: string, code: string): Promise<string | null> {
      if (!/^\d{6}$/.test(code)) return null;
      return deps.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(verifications)
          .where(and(eq(verifications.identifier, identifier(email)), gt(verifications.expiresAt, now())))
          .for("update");
        if (!row) return null;
        const stored = JSON.parse(row.value) as Stored;
        const expected = Buffer.from(stored.hash);
        const given = Buffer.from(hash(email, code));
        if (expected.length === given.length && timingSafeEqual(expected, given)) {
          await tx.delete(verifications).where(eq(verifications.id, row.id));
          return stored.link;
        }
        if (stored.attempts + 1 >= MAX_ATTEMPTS) await tx.delete(verifications).where(eq(verifications.id, row.id));
        else await tx.update(verifications).set({ value: JSON.stringify({ ...stored, attempts: stored.attempts + 1 }) }).where(eq(verifications.id, row.id));
        return null;
      });
    },
  };
}

export type LoginCodes = ReturnType<typeof createLoginCodes>;
