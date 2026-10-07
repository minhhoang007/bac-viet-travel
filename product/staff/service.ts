import { eq } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { ProductContext } from "@/core/product/context";
import type { Db } from "@/db/client";
import { staffRoles, type StaffRoleRow } from "../schema/staff";
import type { StaffRole } from "./permissions";

type Actor = Parameters<NonNullable<ProductContext["audit"]>["audited"]>[0];

export interface StaffService {
  /** The staff role of a user, or null (not staff). */
  roleOf(userId: string): Promise<StaffRole | null>;
  list(): Promise<StaffRoleRow[]>;
  /** Give, change (role) or remove (null) a staff role. Audited. */
  set(actor: Actor, userId: string, role: StaffRole | null): Promise<void>;
}

export function createStaffService(deps: { db: Db; audit?: ProductContext["audit"] }): StaffService {
  const { db } = deps;
  return {
    async roleOf(userId) {
      const [row] = await db.select({ role: staffRoles.role }).from(staffRoles).where(eq(staffRoles.userId, userId));
      return row?.role ?? null;
    },

    list() {
      return db.select().from(staffRoles).orderBy(staffRoles.createdAt);
    },

    async set(actor, userId, role) {
      if (!deps.audit) throw new AppError("MODULE_DISABLED", "Admin module is off");
      await deps.audit.audited(actor, { action: role ? "staff.role" : "staff.remove", targetType: "user", targetId: userId, metadata: { role } }, async () => {
        if (role) await db.insert(staffRoles).values({ userId, role }).onConflictDoUpdate({ target: staffRoles.userId, set: { role, updatedAt: new Date() } });
        else await db.delete(staffRoles).where(eq(staffRoles.userId, userId));
        return true;
      });
    },
  };
}
