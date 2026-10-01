import { bigint, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/core/users/schema";

/**
 * Uploaded files. "pending" = upload URL issued, not yet confirmed; pending rows count toward the quota and are
 * purged (with their object) after an hour. Objects are deleted before the account (see bootstrap).
 */
export const files = pgTable(
  "files",
  {
    id: id(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Object key; never contains the user's file name. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    contentType: text("content_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    status: text("status", { enum: ["pending", "ready"] }).notNull().default("pending"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("files_key_idx").on(t.key), index("files_owner_idx").on(t.ownerId, t.status)],
);

export type FileRow = typeof files.$inferSelect;
