import { and, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db/client";
import type { EntitlementKey, Entitlements, PlanDefinition, PlanId } from "@/config/billing.defaults";
import { accessGrants } from "./schema";

type DbExecutor = Pick<Db, "insert" | "update" | "select" | "execute">;
type GrantSource = "polar_subscription" | "vnpay_order" | "manual";

export interface Access {
  plan: PlanId;
  /** End of the current best grant; null for free or unlimited manual grants. */
  endsAt: Date | null;
  source: GrantSource | null;
}

export interface EntitlementsModule {
  getAccess(userId: string): Promise<Access>;
  can(userId: string, key: EntitlementKey): Promise<boolean>;
  getLimit(userId: string, key: EntitlementKey): Promise<number>;
  /** Create or update the grant for a source (e.g. a subscription); idempotent per (source, sourceId). */
  upsertGrant(grant: { ownerId: string; plan: PlanId; source: GrantSource; sourceId: string; startsAt: Date; endsAt: Date | null }, tx?: DbExecutor): Promise<void>;
  /**
   * Grant one paid period, starting when the user's current access to that plan ends (stacking purchases).
   * Idempotent per (source, sourceId): re-running returns the existing grant.
   */
  grantPeriod(grant: { ownerId: string; plan: PlanId; source: GrantSource; sourceId: string; days: number }, tx?: DbExecutor): Promise<{ startsAt: Date; endsAt: Date }>;
  /** Admin stats: number of users with access to the plan right now. */
  countActiveOwners(plan: PlanId): Promise<number>;
  /**
   * Paid grants ending in [from, to), for renewal reminders and "access ended" notices. `coveredAfter`: the owner has
   * another grant reaching past this one's end (renewed, stacked or unlimited), so there is nothing to tell them.
   */
  endingGrants(range: { from: Date; to: Date; sources?: GrantSource[] }): Promise<EndingGrant[]>;
  /** Owners whose first paid (non-manual) access started at or after `since` (welcome emails). */
  newPaidOwners(since: Date): Promise<{ ownerId: string; plan: PlanId }[]>;
}

export interface EndingGrant {
  id: string;
  ownerId: string;
  plan: PlanId;
  source: GrantSource;
  endsAt: Date;
  coveredAfter: boolean;
}

const RANK: Record<PlanId, number> = { free: 0, pro: 1 };

export function createEntitlementsModule(db: Db, plans: Record<PlanId, PlanDefinition>, now: () => Date = () => new Date()): EntitlementsModule {
  const getAccess = async (userId: string): Promise<Access> => {
    const t = now();
    // Current and future grants; future ones matter for chained (stacked) purchases.
    const grants = (
      await db
        .select({ plan: accessGrants.plan, startsAt: accessGrants.startsAt, endsAt: accessGrants.endsAt, source: accessGrants.source })
        .from(accessGrants)
        .where(and(eq(accessGrants.ownerId, userId), or(isNull(accessGrants.endsAt), gt(accessGrants.endsAt, t))))
    ).filter((g): g is typeof g & { plan: PlanId } => g.plan in plans);
    const best = grants
      .filter((g) => g.startsAt <= t)
      .sort((a, b) => RANK[b.plan] - RANK[a.plan] || (b.endsAt?.getTime() ?? Infinity) - (a.endsAt?.getTime() ?? Infinity))[0];
    if (!best) return { plan: "free", endsAt: null, source: null };

    // endsAt = end of the contiguous chain of grants for the same plan (e.g. two stacked VNPay periods).
    let endsAt = best.endsAt;
    for (let extended = true; endsAt && extended; ) {
      extended = false;
      for (const g of grants) {
        if (g.plan === best.plan && g.startsAt <= endsAt && (!g.endsAt || g.endsAt > endsAt)) {
          endsAt = g.endsAt;
          extended = true;
          if (!endsAt) break;
        }
      }
    }
    return { plan: best.plan, endsAt, source: best.source };
  };

  const entitlementsOf = async (userId: string): Promise<Entitlements> => plans[(await getAccess(userId)).plan].entitlements;

  type PeriodGrant = Parameters<EntitlementsModule["grantPeriod"]>[0];
  const grantPeriodIn = async (tx: DbExecutor, grant: PeriodGrant) => {
    // Concurrent payments for the same plan must stack: serialize them until the transaction ends.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`grant:${grant.ownerId}:${grant.plan}`}))`);
    const [existing] = await tx
      .select({ startsAt: accessGrants.startsAt, endsAt: accessGrants.endsAt })
      .from(accessGrants)
      .where(and(eq(accessGrants.source, grant.source), eq(accessGrants.sourceId, grant.sourceId)));
    if (existing?.endsAt) return { startsAt: existing.startsAt, endsAt: existing.endsAt };

    const t = now();
    const [latest] = await tx
      .select({ endsAt: accessGrants.endsAt })
      .from(accessGrants)
      .where(and(eq(accessGrants.ownerId, grant.ownerId), eq(accessGrants.plan, grant.plan), gt(accessGrants.endsAt, t)))
      .orderBy(desc(accessGrants.endsAt))
      .limit(1);
    const startsAt = latest?.endsAt && latest.endsAt > t ? latest.endsAt : t;
    const endsAt = new Date(startsAt.getTime() + grant.days * 24 * 60 * 60_000);
    await tx.insert(accessGrants).values({ ...grant, startsAt, endsAt }).onConflictDoNothing();
    return { startsAt, endsAt };
  };

  return {
    getAccess,
    async can(userId, key) {
      return Boolean((await entitlementsOf(userId))[key]);
    },
    async getLimit(userId, key) {
      const value = (await entitlementsOf(userId))[key];
      return typeof value === "number" ? value : value ? Number.POSITIVE_INFINITY : 0;
    },
    async upsertGrant(grant, tx = db) {
      await tx
        .insert(accessGrants)
        .values(grant)
        .onConflictDoUpdate({
          target: [accessGrants.source, accessGrants.sourceId],
          set: { plan: grant.plan, startsAt: grant.startsAt, endsAt: grant.endsAt, updatedAt: sql`now()` },
        });
    },
    grantPeriod: (grant, tx) => (tx ? grantPeriodIn(tx, grant) : db.transaction((t) => grantPeriodIn(t, grant))),
    async countActiveOwners(plan) {
      const t = now();
      const [row] = await db
        .select({ n: sql<number>`count(distinct ${accessGrants.ownerId})::int` })
        .from(accessGrants)
        .where(and(eq(accessGrants.plan, plan), lte(accessGrants.startsAt, t), or(isNull(accessGrants.endsAt), gt(accessGrants.endsAt, t))));
      return row?.n ?? 0;
    },
    async endingGrants({ from, to, sources = ["polar_subscription", "vnpay_order"] }) {
      // Outer table aliased "g" and named literally in the subquery: Drizzle renders select-field columns
      // unqualified, which inside the subquery would resolve to the inner table.
      const g = alias(accessGrants, "g");
      const rows = await db
        .select({
          id: g.id,
          ownerId: g.ownerId,
          plan: g.plan,
          source: g.source,
          endsAt: g.endsAt,
          coveredAfter: sql<boolean>`exists (
            select 1 from access_grants o
            where o.owner_id = g.owner_id and o.id <> g.id and (o.ends_at is null or o.ends_at > g.ends_at)
          )`,
        })
        .from(g)
        .where(and(gte(g.endsAt, from), lt(g.endsAt, to), inArray(g.source, sources)))
        .orderBy(g.endsAt);
      return rows.map((r) => ({ ...r, plan: r.plan as PlanId, endsAt: r.endsAt! }));
    },
    async newPaidOwners(since) {
      const rows = await db
        .select({ ownerId: accessGrants.ownerId, plan: sql<PlanId>`(array_agg(${accessGrants.plan} order by ${accessGrants.startsAt}))[1]` })
        .from(accessGrants)
        .where(sql`${accessGrants.source} <> 'manual'`)
        .groupBy(accessGrants.ownerId)
        .having(sql`min(${accessGrants.startsAt}) >= ${since.toISOString()}`);
      return rows.map(({ ownerId, plan }) => ({ ownerId, plan }));
    },
  };
}
