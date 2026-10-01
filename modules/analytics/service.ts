import { createHash, createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { analyticsEvents } from "./schema";

export const PAGE_VIEW = "page_view";

export interface CollectInput {
  path: string;
  referrer?: string | null;
  /** Used only to derive the daily visitor hash, never stored. */
  ip: string;
  userAgent: string;
  consent: boolean;
  userId?: string | null;
  /** Site host; referrers from it are not stored. */
  siteHost: string;
}

export interface AnalyticsStats {
  daily: { day: string; views: number; visitors: number }[];
  topPages: { path: string; views: number }[];
  topReferrers: { host: string; views: number }[];
  events: { name: string; count: number }[];
}

export interface AnalyticsModule {
  /** Page view from the browser beacon. Returns false when the request was ignored (bot, invalid path). */
  collect(input: CollectInput): Promise<boolean>;
  /**
   * Custom server-side event (e.g. "project_created"). Pass userId only for users who consented
   * (the caller knows the consent cookie). Props must not contain personal data.
   */
  track(name: string, options?: { userId?: string | null; props?: Record<string, string | number | boolean> }): Promise<void>;
  stats(days: number): Promise<AnalyticsStats>;
  /** Retention: delete events older than `days` (default 13 months). */
  purge(days?: number): Promise<number>;
  /** Account export: events linked to the user (consented ones only). */
  exportForUser(userId: string): Promise<unknown[]>;
}

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python-requests|go-http-client/i;
const EVENT_NAME = /^[a-z][a-z0-9_]{0,63}$/;

/** Path without query string or fragment (they can carry tokens or emails). */
export function cleanPath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const clean = path.split(/[?#]/)[0]!.slice(0, 200);
  return clean || "/";
}

export function referrerHost(referrer: string | null | undefined, siteHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host && host !== siteHost ? host.slice(0, 100) : null;
  } catch {
    return null;
  }
}

/**
 * Same visitor + same UTC day → same hash; a new day gives an unrelated hash, so visitors cannot be followed
 * across days. Keyed with a server secret so the hash cannot be recomputed from an IP alone.
 */
export function visitorHash(secret: string, day: string, ip: string, userAgent: string): string {
  const dailyKey = createHmac("sha256", secret).update(day).digest();
  return createHash("sha256").update(dailyKey).update(ip).update("\n").update(userAgent).digest("hex").slice(0, 32);
}

export function createAnalyticsModule(deps: { db: Db; secret: string; now?: () => Date }): AnalyticsModule {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    async collect(input) {
      if (BOT.test(input.userAgent)) return false;
      const path = cleanPath(input.path);
      if (!path) return false;
      const t = now();
      await db.insert(analyticsEvents).values({
        name: PAGE_VIEW,
        path,
        referrerHost: referrerHost(input.referrer, input.siteHost),
        visitorHash: input.consent ? visitorHash(deps.secret, t.toISOString().slice(0, 10), input.ip, input.userAgent) : null,
        userId: input.consent ? (input.userId ?? null) : null,
        createdAt: t,
      });
      return true;
    },

    async track(name, options = {}) {
      if (!EVENT_NAME.test(name)) throw new Error(`invalid analytics event name "${name}"`);
      await db.insert(analyticsEvents).values({ name, userId: options.userId ?? null, props: options.props ?? {}, createdAt: now() });
    },

    async stats(days) {
      const since = sql`(${now().toISOString()}::timestamptz at time zone 'utc')::date - ${days - 1}::int`;
      const daily = await db.execute<{ day: string; views: number; visitors: number }>(sql`
        select to_char(d.day, 'YYYY-MM-DD') as day,
               count(e.id)::int as views,
               count(distinct e.visitor_hash)::int as visitors
        from generate_series(${since}, (${now().toISOString()}::timestamptz at time zone 'utc')::date, '1 day') as d(day)
        left join analytics_events e on e.name = ${PAGE_VIEW} and (e.created_at at time zone 'utc')::date = d.day
        group by d.day order by d.day`);
      const range = sql`created_at >= ${since}`;
      const topPages = await db.execute<{ path: string; views: number }>(sql`
        select path, count(*)::int as views from analytics_events
        where name = ${PAGE_VIEW} and ${range} group by path order by views desc limit 10`);
      const topReferrers = await db.execute<{ host: string; views: number }>(sql`
        select referrer_host as host, count(*)::int as views from analytics_events
        where name = ${PAGE_VIEW} and referrer_host is not null and ${range} group by referrer_host order by views desc limit 10`);
      const events = await db.execute<{ name: string; count: number }>(sql`
        select name, count(*)::int as count from analytics_events
        where name <> ${PAGE_VIEW} and ${range} group by name order by count desc limit 20`);
      const rows = <T>(r: unknown) => [...(r as T[])];
      return { daily: rows(daily), topPages: rows(topPages), topReferrers: rows(topReferrers), events: rows(events) };
    },

    async purge(days = 395) {
      const deleted = await db.execute(sql`
        delete from analytics_events where created_at < ${now().toISOString()}::timestamptz - make_interval(days => ${days}) returning id`);
      return (deleted as unknown as unknown[]).length;
    },

    async exportForUser(userId) {
      return db
        .select({ name: analyticsEvents.name, path: analyticsEvents.path, props: analyticsEvents.props, createdAt: analyticsEvents.createdAt })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.userId, userId));
    },
  };
}
