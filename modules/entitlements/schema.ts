import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/core/users/schema";

/**
 * Time-bounded access to a plan (ADR-0005). A user's plan = the best plan among grants active now.
 * Sources: a Polar subscription (extended every period), a VNPay order (one period), or a manual grant.
 */
export const accessGrants = pgTable(
  "access_grants",
  {
    id: id(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    source: text("source", { enum: ["polar_subscription", "vnpay_order", "manual"] }).notNull(),
    sourceId: text("source_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /** null = no end (manual grants only). */
    endsAt: timestamp("ends_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("access_grants_source_idx").on(t.source, t.sourceId),
    index("access_grants_owner_idx").on(t.ownerId, t.endsAt),
  ],
);

export type AccessGrant = typeof accessGrants.$inferSelect;
