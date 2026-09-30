import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import type { EntitlementKey, Entitlements, PlanDefinition, PlanId } from "@/config/billing.defaults";
import { accessGrants } from "./schema";

type DbExecutor = Pick<Db, "insert" | "update" | "select">;
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
    async grantPeriod(grant, tx = db) {
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
    },
  };
}
