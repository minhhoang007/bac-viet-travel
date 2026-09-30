import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/core/users/schema";

/** Contributed by product/modules so an export contains all of a user's data. */
export interface AccountDataExporter {
  name: string;
  export(userId: string): Promise<unknown>;
}

export interface AccountService {
  /** Hard delete; sessions, accounts and owned rows go via ON DELETE CASCADE. */
  deleteAccount(userId: string): Promise<void>;
  exportAccount(userId: string): Promise<Record<string, unknown>>;
}

export function createAccountService(db: Db, exporters: readonly AccountDataExporter[]): AccountService {
  return {
    async deleteAccount(userId) {
      await db.delete(users).where(eq(users.id, userId));
    },
    async exportAccount(userId) {
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name, image: users.image, role: users.role, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, userId));
      const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), user: user ?? null };
      for (const exporter of exporters) data[exporter.name] = await exporter.export(userId);
      return data;
    },
  };
}
