import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { billingDefaults } from "@/config/billing.defaults";
import { users } from "@/core/users/schema";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { createEntitlementsModule } from "..";

const handle = testDb();
const db = handle.db;
let clock = new Date("2026-10-01T00:00:00Z");
const ent = createEntitlementsModule(db, billingDefaults.plans, () => clock);
const DAY = 24 * 60 * 60_000;

async function user() {
  const [u] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.com` }).returning();
  return u!.id;
}

beforeEach(async () => {
  await resetDb(db);
  clock = new Date("2026-10-01T00:00:00Z");
});
afterAll(() => handle.close());

describe("entitlements (time-bounded grants)", () => {
  it("defaults to the free plan", async () => {
    const id = await user();
    expect(await ent.getAccess(id)).toEqual({ plan: "free", endsAt: null, source: null });
    expect(await ent.can(id, "app.pro_features")).toBe(false);
    expect(await ent.getLimit(id, "notes.max")).toBe(20);
  });

  it("a period grant gives pro until it ends", async () => {
    const id = await user();
    const { endsAt } = await ent.grantPeriod({ ownerId: id, plan: "pro", source: "vnpay_order", sourceId: "o1", days: 30 });
    expect(endsAt.getTime()).toBe(clock.getTime() + 30 * DAY);
    expect(await ent.can(id, "app.pro_features")).toBe(true);
    expect(await ent.getLimit(id, "notes.max")).toBe(10_000);

    clock = new Date(endsAt.getTime() + 1);
    expect((await ent.getAccess(id)).plan).toBe("free");
  });

  it("stacks consecutive purchases instead of overlapping them", async () => {
    const id = await user();
    await ent.grantPeriod({ ownerId: id, plan: "pro", source: "vnpay_order", sourceId: "o1", days: 30 });
    const second = await ent.grantPeriod({ ownerId: id, plan: "pro", source: "vnpay_order", sourceId: "o2", days: 30 });
    expect(second.endsAt.getTime()).toBe(clock.getTime() + 60 * DAY);
    expect((await ent.getAccess(id)).endsAt?.getTime()).toBe(clock.getTime() + 60 * DAY);
  });

  it("grantPeriod is idempotent per source", async () => {
    const id = await user();
    const a = await ent.grantPeriod({ ownerId: id, plan: "pro", source: "vnpay_order", sourceId: "o1", days: 30 });
    const b = await ent.grantPeriod({ ownerId: id, plan: "pro", source: "vnpay_order", sourceId: "o1", days: 30 });
    expect(b).toEqual(a);
  });

  it("upsertGrant moves the end (subscription renewed, then revoked)", async () => {
    const id = await user();
    const base = { ownerId: id, plan: "pro" as const, source: "polar_subscription" as const, sourceId: "sub_1", startsAt: clock };
    await ent.upsertGrant({ ...base, endsAt: new Date(clock.getTime() + 30 * DAY) });
    expect((await ent.getAccess(id)).plan).toBe("pro");
    await ent.upsertGrant({ ...base, endsAt: clock });
    expect((await ent.getAccess(id)).plan).toBe("free");
  });
});

// Type-level check (enforced by `pnpm typecheck`): unknown entitlement keys do not compile.
export function _typeChecks(id: string) {
  // @ts-expect-error — "ai.unknown" is not an EntitlementKey
  void ent.can(id, "ai.unknown");
  void ent.can(id, "app.pro_features");
}
