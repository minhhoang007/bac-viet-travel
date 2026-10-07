import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "@/db/columns";
import { STAFF_ROLES } from "../staff/permissions";

/** Staff role of an editor for booking work (product/staff/permissions.ts). Admins need none. */
export const staffRoles = pgTable("staff_roles", {
  /** users.id (starter table); no foreign key across the starter/product migration sets. */
  userId: uuid("user_id").primaryKey(),
  role: text("role", { enum: STAFF_ROLES }).notNull(),
  ...timestamps(),
});
export type StaffRoleRow = typeof staffRoles.$inferSelect;
