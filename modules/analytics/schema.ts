import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "@/db/columns";
import { users } from "@/core/users/schema";

/**
 * First-party events. No raw IP or user agent is stored. visitor_hash (daily-rotating, keyed hash) and user_id
 * are set only with analytics consent; without consent an event is an anonymous count.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    name: text("name").notNull(),
    path: text("path"),
    referrerHost: text("referrer_host"),
    visitorHash: text("visitor_hash"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    props: jsonb("props").$type<Record<string, string | number | boolean>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analytics_events_created_idx").on(t.createdAt), index("analytics_events_name_created_idx").on(t.name, t.createdAt)],
);
