import { index, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";

/** DEMO_MODE only: emails the site would have sent, shown in the admin's demo mailbox instead of being delivered. */
export const demoEmails = pgTable(
  "demo_emails",
  {
    id: id(),
    kind: text("kind").notNull(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    text: text("text").notNull(),
    ...timestamps(),
  },
  (t) => [index("demo_emails_created_idx").on(t.createdAt)],
);

export type DemoEmail = typeof demoEmails.$inferSelect;
