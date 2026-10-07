import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/core/errors";
import type { ProductContext } from "@/core/product/context";
import type { Db } from "@/db/client";
import { discountCodes, type DiscountCode } from "../schema/booking";
import { takesSeatsB } from "./status";

type Actor = Parameters<NonNullable<ProductContext["audit"]>["audited"]>[0];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid");
const optionalInt = (max: number) =>
  z.preprocess((v) => (v === "" || v === undefined || v === null ? null : v), z.coerce.number({ message: "invalid" }).int("invalid").min(0, "invalid").max(max, "invalid").nullable());

/** Staff form for a new discount code (D6). Errors are codes; the admin page maps them to text. */
const discountInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9-]{3,30}$/, "invalid")),
    kind: z.enum(["percent", "amount"], { message: "invalid" }),
    value: z.coerce.number({ message: "invalid" }).int("invalid").positive("invalid"),
    validFrom: day,
    validTo: day,
    tourSlug: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "invalid").nullable()).default(null),
    minTotalVnd: optionalInt(1_000_000_000).transform((v) => v ?? 0),
    maxUses: optionalInt(100_000),
    note: z.string().trim().max(200, "too_long").default(""),
  })
  .refine((v) => v.kind !== "percent" || v.value <= 90, { path: ["value"], message: "invalid" })
  .refine((v) => v.validFrom <= v.validTo, { path: ["validTo"], message: "invalid" });

export type DiscountRow = DiscountCode & { used: number };
export type CreateDiscountResult = { status: "created" } | { status: "invalid"; fieldErrors: Record<string, string> } | { status: "taken" };

export interface DiscountAdmin {
  /** Every code, newest first, with its live uses (held, paid, confirmed bookings). */
  list(): Promise<DiscountRow[]>;
  create(actor: Actor, raw: Record<string, unknown>): Promise<CreateDiscountResult>;
  /** Turn a code off (or on again). Bookings that used it keep their price. */
  setActive(actor: Actor, id: string, active: boolean): Promise<boolean>;
}

export function createDiscountAdmin(deps: { db: Db; audit?: ProductContext["audit"]; now?: () => Date }): DiscountAdmin {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());
  const audited = (actor: Actor, action: string, targetId: string, metadata: Record<string, unknown>, work: () => Promise<boolean>) => {
    if (!deps.audit) throw new AppError("MODULE_DISABLED", "Admin module is off");
    return deps.audit.audited(actor, { action, targetType: "discount", targetId, metadata }, work);
  };

  return {
    async list() {
            return db
        .select({
          code: discountCodes,
          // Columns written out: inside a correlated subquery Drizzle renders a bare "code" (= bookings.code here).
          used: sql<number>`(select count(*)::int from bookings b where b.discount_code = discount_codes.code and ${takesSeatsB(now())})`,
        })
        .from(discountCodes)
        .orderBy(desc(discountCodes.createdAt))
        .then((rows) => rows.map((r) => ({ ...r.code, used: r.used })));
    },

    async create(actor, raw) {
      const parsed = discountInputSchema.safeParse(raw);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message === "too_long" ? "too_long" : "invalid";
        return { status: "invalid", fieldErrors };
      }
      const input = parsed.data;
      let taken = false;
      await audited(actor, "discount.create", input.code, { kind: input.kind, value: input.value, validFrom: input.validFrom, validTo: input.validTo }, async () => {
        const inserted = await db.insert(discountCodes).values(input).onConflictDoNothing().returning({ id: discountCodes.id });
        taken = inserted.length === 0;
        return !taken;
      });
      return taken ? { status: "taken" } : { status: "created" };
    },

    async setActive(actor, id, active) {
      if (!z.uuid().safeParse(id).success) return false;
      return audited(actor, active ? "discount.enable" : "discount.disable", id, {}, async () => {
        const updated = await db.update(discountCodes).set({ active }).where(eq(discountCodes.id, id)).returning({ id: discountCodes.id });
        return updated.length > 0;
      });
    },
  };
}
