import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { sessions } from "@/core/auth/schema";
import { AppError } from "@/core/errors";
import type { Logger } from "@/core/logger";
import { users, type UserRow } from "@/core/users/schema";
import type { Db } from "@/db/client";
import { auditLogs, type AuditLogRow } from "./schema";

type DbExecutor = Pick<Db, "insert" | "update" | "select" | "delete">;

export interface Actor {
  id: string;
  email: string;
}

export type UserSummary = Pick<UserRow, "id" | "email" | "name" | "role" | "status" | "createdAt">;

export interface AdminModule {
  listUsers(options?: { query?: string; page?: number; pageSize?: number }): Promise<{ rows: UserSummary[]; total: number }>;
  getUser(userId: string): Promise<UserSummary | null>;
  /** Disabling also ends the user's sessions. Admins cannot disable or demote themselves (no lock-out). */
  setUserStatus(actor: Actor, userId: string, status: UserRow["status"]): Promise<void>;
  setUserRole(actor: Actor, userId: string, role: UserRow["role"]): Promise<void>;
  /**
   * Runs an admin action and records it in the audit log. The entry is written only if the action succeeds
   * and reports a change; use it for every admin action that changes state.
   */
  audited(actor: Actor, entry: AuditEntry, action: () => Promise<boolean>): Promise<boolean>;
  listAudit(options?: { page?: number; pageSize?: number; targetId?: string }): Promise<{ rows: AuditLogRow[]; total: number }>;
  /** Stats: new users per UTC day for the last `days` days. */
  signupsByDay(days: number): Promise<{ day: string; count: number }[]>;
}

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

const userColumns = { id: users.id, email: users.email, name: users.name, role: users.role, status: users.status, createdAt: users.createdAt };

export function createAdminModule(deps: { db: Db; logger: Logger }): AdminModule {
  const { db, logger } = deps;

  const record = async (actor: Actor, entry: AuditEntry, tx: DbExecutor = db) => {
    await tx.insert(auditLogs).values({ actorId: actor.id, actorEmail: actor.email, ...entry, metadata: entry.metadata ?? {} });
    logger.info("admin.action", { actorId: actor.id, action: entry.action, targetType: entry.targetType, targetId: entry.targetId });
  };

  const notSelf = (actor: Actor, userId: string) => {
    if (actor.id === userId) throw new AppError("PERMISSION_ERROR", "Admins cannot change their own role or status");
  };

  return {
    async listUsers({ query, page = 1, pageSize = 25 } = {}) {
      const where = query ? ilike(users.email, `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`) : undefined;
      const rows = await db
        .select(userColumns)
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(pageSize)
        .offset((Math.max(1, page) - 1) * pageSize);
      const [total] = await db.select({ n: count() }).from(users).where(where);
      return { rows, total: total?.n ?? 0 };
    },

    async getUser(userId) {
      const [row] = await db.select(userColumns).from(users).where(eq(users.id, userId));
      return row ?? null;
    },

    async setUserStatus(actor, userId, status) {
      notSelf(actor, userId);
      await db.transaction(async (tx) => {
        const [before] = await tx.select({ status: users.status }).from(users).where(eq(users.id, userId)).for("update");
        if (!before) throw new AppError("NOT_FOUND");
        if (before.status === status) return;
        await tx.update(users).set({ status }).where(eq(users.id, userId));
        if (status === "disabled") await tx.delete(sessions).where(eq(sessions.userId, userId));
        await record(actor, { action: `user.${status === "disabled" ? "disable" : "enable"}`, targetType: "user", targetId: userId }, tx);
      });
    },

    async setUserRole(actor, userId, role) {
      notSelf(actor, userId);
      await db.transaction(async (tx) => {
        const [before] = await tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).for("update");
        if (!before) throw new AppError("NOT_FOUND");
        if (before.role === role) return;
        await tx.update(users).set({ role }).where(eq(users.id, userId));
        await record(actor, { action: "user.set_role", targetType: "user", targetId: userId, metadata: { from: before.role, to: role } }, tx);
      });
    },

    async audited(actor, entry, action) {
      const changed = await action();
      if (changed) await record(actor, entry);
      return changed;
    },

    async listAudit({ page = 1, pageSize = 50, targetId } = {}) {
      const where = targetId ? and(eq(auditLogs.targetId, targetId)) : undefined;
      const rows = await db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(pageSize)
        .offset((Math.max(1, page) - 1) * pageSize);
      const [total] = await db.select({ n: count() }).from(auditLogs).where(where);
      return { rows, total: total?.n ?? 0 };
    },

    async signupsByDay(days) {
      const rows = await db.execute<{ day: string; count: number }>(sql`
        select to_char(d.day, 'YYYY-MM-DD') as day, count(u.id)::int as count
        from generate_series((now() at time zone 'utc')::date - ${days - 1}::int, (now() at time zone 'utc')::date, '1 day') as d(day)
        left join users u on (u.created_at at time zone 'utc')::date = d.day
        group by d.day order by d.day`);
      return [...(rows as unknown as { day: string; count: number }[])];
    },
  };
}
