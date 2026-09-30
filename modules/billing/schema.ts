import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/core/users/schema";

/**
 * Incoming provider events. Receiving ≠ processing: received → processing → processed | failed | dead.
 * A sweeper re-queues stale rows, so an event can never stay stuck in "received".
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    providerCreatedAt: timestamp("provider_created_at", { withTimezone: true }),
    status: text("status", { enum: ["received", "processing", "processed", "failed", "dead"] }).notNull().default("received"),
    attempts: integer("attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_idx").on(t.provider, t.eventId), index("webhook_events_status_idx").on(t.status)],
);

/** Polar subscriptions. Financial records: owner is set to null (anonymized) when the account is deleted. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    plan: text("plan").notNull(),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /** Provider-side modification time of the state we stored; older events are ignored (out-of-order safety). */
    providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("subscriptions_provider_id_idx").on(t.provider, t.providerSubscriptionId), index("subscriptions_owner_idx").on(t.ownerId)],
);

/** One-time purchases (VNPay). Amount in minor units (VND: đồng). Owner anonymized on account deletion. */
export const billingOrders = pgTable(
  "billing_orders",
  {
    id: id(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    plan: text("plan").notNull(),
    interval: text("interval", { enum: ["month", "year"] }).notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: ["pending", "paid", "failed"] }).notNull().default("pending"),
    /** Reference sent to the provider (VNPay vnp_TxnRef). */
    txnRef: text("txn_ref").notNull(),
    providerTransactionId: text("provider_transaction_id"),
    providerResponse: jsonb("provider_response").$type<Record<string, string>>(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("billing_orders_txn_ref_idx").on(t.provider, t.txnRef), index("billing_orders_owner_idx").on(t.ownerId)],
);

export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type BillingOrder = typeof billingOrders.$inferSelect;
