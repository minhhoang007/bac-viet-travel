import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";
import { users } from "@/core/users/schema";

export const notes = pgTable(
  "notes",
  {
    id: id(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    ...timestamps(),
  },
  (t) => [index("notes_owner_id_idx").on(t.ownerId)],
);

export type Note = typeof notes.$inferSelect;
