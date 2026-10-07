import { and, desc, eq, gt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { authEvents, type AuthEventKind } from "./schema";

const NEW_DEVICE_WINDOW_MS = 90 * 24 * 3_600_000;
const MAX_UA = 300;

export interface AuthEvent {
  kind: AuthEventKind;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/** Security log of an account: sign-ins and second-factor changes (shown on the security page). */
export function createAuthEvents(deps: { db: Db; now?: () => Date }) {
  const now = () => deps.now?.() ?? new Date();
  return {
    async record(userId: string, kind: AuthEventKind, client: { ipAddress?: string | null; userAgent?: string | null } = {}): Promise<void> {
      await deps.db.insert(authEvents).values({ userId, kind, ipAddress: client.ipAddress ?? null, userAgent: client.userAgent?.slice(0, MAX_UA) ?? null });
    },

    /** No sign-in from this browser (same user agent) in the last 90 days. */
    async isNewDevice(userId: string, userAgent: string | null | undefined): Promise<boolean> {
      const ua = userAgent?.slice(0, MAX_UA) ?? null;
      if (!ua) return true;
      const since = new Date(now().getTime() - NEW_DEVICE_WINDOW_MS);
      const [seen] = await deps.db
        .select({ id: authEvents.id })
        .from(authEvents)
        .where(and(eq(authEvents.userId, userId), eq(authEvents.kind, "sign_in"), eq(authEvents.userAgent, ua), gt(authEvents.createdAt, since)))
        .limit(1);
      return !seen;
    },

    async recent(userId: string, limit = 20): Promise<AuthEvent[]> {
      return deps.db
        .select({ kind: authEvents.kind, ipAddress: authEvents.ipAddress, userAgent: authEvents.userAgent, createdAt: authEvents.createdAt })
        .from(authEvents)
        .where(eq(authEvents.userId, userId))
        .orderBy(desc(authEvents.createdAt))
        .limit(limit);
    },
  };
}

export type AuthEvents = ReturnType<typeof createAuthEvents>;

/** "Chrome on Windows"-style label from a user agent, for emails and the device list. */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ") || "?";
}
