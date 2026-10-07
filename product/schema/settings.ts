import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps } from "@/db/columns";

/** Site-wide settings an admin changes at run time, one row per key (e.g. "theme": product/theme). */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  ...timestamps(),
});
