import { boolean, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";

/** user: customer. editor: staff who edit content (no access to users, money, jobs). admin: everything. */
export const ROLES = ["user", "editor", "admin"] as const;

// Field names follow Better Auth's user model; role/status are additional fields.
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name").notNull().default(""),
  image: text("image"),
  role: text("role", { enum: ROLES }).notNull().default("user"),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  /** Better Auth two-factor plugin: TOTP set up and confirmed. */
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  ...timestamps(),
});

export type UserRow = typeof users.$inferSelect;
