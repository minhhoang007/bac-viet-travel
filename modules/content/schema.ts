import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/core/users/schema";

export const CONTENT_STATUSES = ["draft", "pending", "approved", "published"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * One piece of staff-edited content (ADR-0009). `draft` is the working copy; `published` is what visitors see
 * (null until first published). `status` describes the draft: "published" means the draft equals the live copy.
 */
export const contentItems = pgTable(
  "content_items",
  {
    id: id(),
    /** Project content type, e.g. "tour" or "post" (manifest `contentTypes`). */
    type: text("type").notNull(),
    slug: text("slug").notNull(),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    draft: jsonb("draft").$type<Record<string, unknown>>().notNull(),
    published: jsonb("published").$type<Record<string, unknown>>(),
    /** Slug of the live copy (public lookups), so renaming a draft does not break the live URL before publishing. */
    publishedSlug: text("published_slug"),
    /** Live copy taken offline by an admin (kept, can be shown again). */
    hidden: boolean("hidden").notNull().default(false),
    /** Approved for publishing at this time (status "approved"). */
    publishAt: timestamp("publish_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Optimistic lock: every change increments it; writers send the revision they edited. */
    revision: integer("revision").notNull().default(1),
    /** Reviewer's note on the last rejection. */
    reviewNote: text("review_note"),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("content_items_type_slug_idx").on(t.type, t.slug),
    index("content_items_published_slug_idx").on(t.type, t.publishedSlug),
    index("content_items_status_idx").on(t.status, t.publishAt),
  ],
);

/** Snapshots taken when a draft is submitted or published; restoring copies one back into the draft. */
export const contentVersions = pgTable(
  "content_versions",
  {
    id: id(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    event: text("event", { enum: ["submitted", "published"] }).notNull(),
    slug: text("slug").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("content_versions_item_idx").on(t.itemId, t.createdAt)],
);

export type ContentItemRow = typeof contentItems.$inferSelect;
export type ContentVersionRow = typeof contentVersions.$inferSelect;
