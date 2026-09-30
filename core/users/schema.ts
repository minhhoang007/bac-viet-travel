import { boolean, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/db/columns";

// Field names follow Better Auth's user model; role/status are additional fields.
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name").notNull().default(""),
  image: text("image"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  ...timestamps(),
});

export type UserRow = typeof users.$inferSelect;
