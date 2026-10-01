import { and, desc, eq, lt, sql } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { Logger } from "@/core/logger";
import type { Db } from "@/db/client";
import type { StorageConfig } from "@/config/storage.defaults";
import type { ObjectStorage } from "./ports";
import { files, type FileRow } from "./schema";

export type FileSummary = Pick<FileRow, "id" | "name" | "contentType" | "size" | "createdAt">;

export interface StorageModule {
  config: StorageConfig;
  /**
   * Validates type, size and quota, reserves the space (pending row) and returns a presigned upload URL.
   * Throws VALIDATION_ERROR (type/size) or QUOTA_EXCEEDED.
   */
  requestUpload(userId: string, input: { name: string; contentType: string; size: number }): Promise<{ fileId: string; url: string; headers: Record<string, string> }>;
  /** After the browser upload: checks the stored object matches what was reserved, then marks it ready. */
  confirmUpload(userId: string, fileId: string): Promise<FileSummary>;
  list(userId: string): Promise<FileSummary[]>;
  usage(userId: string): Promise<{ usedBytes: number; quotaBytes: number }>;
  /** Short-lived download URL. NOT_FOUND unless the file is the user's own and ready. */
  downloadUrl(userId: string, fileId: string): Promise<string>;
  remove(userId: string, fileId: string): Promise<void>;
  /** Account deletion hook: deletes every object of the user (throws on storage failure → deletion aborts). */
  deleteAllForUser(userId: string): Promise<number>;
  exportForUser(userId: string): Promise<FileSummary[]>;
  /** Periodic: drop reservations whose upload was never confirmed. */
  purgePending(): Promise<number>;
  /** Admin: totals across all users. */
  totals(): Promise<{ files: number; bytes: number; users: number }>;
}

export interface StorageDeps {
  db: Db;
  logger: Logger;
  objects: ObjectStorage;
  config: StorageConfig;
  /** Per-user quota in bytes (the "storage.max_bytes" entitlement). */
  quotaFor(userId: string): Promise<number>;
}

const summary = { id: files.id, name: files.name, contentType: files.contentType, size: files.size, createdAt: files.createdAt };

/** Display name: no path parts or control characters, bounded length. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
  return clean || "file";
}

export function createStorageModule(deps: StorageDeps): StorageModule {
  const { db, logger, objects, config } = deps;

  const usedBytes = async (userId: string, tx: Pick<Db, "select"> = db) => {
    const [row] = await tx.select({ n: sql<number>`coalesce(sum(${files.size}), 0)::bigint` }).from(files).where(eq(files.ownerId, userId));
    return Number(row?.n ?? 0);
  };

  // Abandoned reservations (upload never confirmed) stop counting toward the quota after this long.
  const PENDING_MINUTES = 60;
  const purgeStale = async (userId?: string) => {
    const stale = await db
      .select({ id: files.id, key: files.key })
      .from(files)
      .where(
        and(
          eq(files.status, "pending"),
          lt(files.createdAt, sql`now() - make_interval(mins => ${PENDING_MINUTES})`),
          userId ? eq(files.ownerId, userId) : undefined,
        ),
      )
      .limit(500);
    if (!stale.length) return 0;
    await objects.delete(stale.map((r) => r.key));
    for (const { id } of stale) await db.delete(files).where(and(eq(files.id, id), eq(files.status, "pending")));
    return stale.length;
  };

  const ownFile = async (userId: string, fileId: string) => {
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw new AppError("NOT_FOUND");
    const [row] = await db.select().from(files).where(and(eq(files.id, fileId), eq(files.ownerId, userId)));
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  };

  return {
    config,

    async requestUpload(userId, input) {
      const contentType = input.contentType.toLowerCase();
      if (!config.allowedTypes.includes(contentType)) throw new AppError("VALIDATION_ERROR", "File type not allowed");
      if (!Number.isInteger(input.size) || input.size <= 0 || input.size > config.maxFileBytes) {
        throw new AppError("VALIDATION_ERROR", "File too large");
      }
      // Also covers projects without the jobs module, where purgePending() never runs periodically.
      await purgeStale(userId);
      const quota = await deps.quotaFor(userId);
      const key = `u/${userId}/${crypto.randomUUID()}`;
      const fileId = await db.transaction(async (tx) => {
        // Serialize uploads of one user so parallel requests cannot overshoot the quota.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`storage:${userId}`}, 0))`);
        if ((await usedBytes(userId, tx)) + input.size > quota) throw new AppError("QUOTA_EXCEEDED");
        const [row] = await tx
          .insert(files)
          .values({ ownerId: userId, key, name: safeFileName(input.name), contentType, size: input.size })
          .returning({ id: files.id });
        return row!.id;
      });
      const put = await objects.presignPut({ key, contentType, contentLength: input.size, expiresIn: config.uploadUrlTtl });
      return { fileId, ...put };
    },

    async confirmUpload(userId, fileId) {
      const row = await ownFile(userId, fileId);
      if (row.status === "ready") return { id: row.id, name: row.name, contentType: row.contentType, size: row.size, createdAt: row.createdAt };
      const head = await objects.head(row.key);
      if (!head || head.size !== row.size || (head.contentType ?? "").toLowerCase() !== row.contentType) {
        // Upload missing or not what was validated: drop it and free the reservation.
        if (head) await objects.delete([row.key]);
        await db.delete(files).where(eq(files.id, row.id));
        logger.warn("storage.upload_rejected", { fileId: row.id, reason: head ? "mismatch" : "missing" });
        throw new AppError("VALIDATION_ERROR", "Upload did not complete");
      }
      const [ready] = await db.update(files).set({ status: "ready" }).where(eq(files.id, row.id)).returning(summary);
      return ready!;
    },

    async list(userId) {
      return db.select(summary).from(files).where(and(eq(files.ownerId, userId), eq(files.status, "ready"))).orderBy(desc(files.createdAt));
    },

    async usage(userId) {
      return { usedBytes: await usedBytes(userId), quotaBytes: await deps.quotaFor(userId) };
    },

    async downloadUrl(userId, fileId) {
      const row = await ownFile(userId, fileId);
      if (row.status !== "ready") throw new AppError("NOT_FOUND");
      return objects.presignGet({ key: row.key, filename: row.name, expiresIn: config.downloadUrlTtl });
    },

    async remove(userId, fileId) {
      const row = await ownFile(userId, fileId);
      await objects.delete([row.key]);
      await db.delete(files).where(eq(files.id, row.id));
    },

    async deleteAllForUser(userId) {
      const rows = await db.select({ key: files.key }).from(files).where(eq(files.ownerId, userId));
      if (rows.length) await objects.delete(rows.map((r) => r.key));
      await db.delete(files).where(eq(files.ownerId, userId));
      return rows.length;
    },

    async exportForUser(userId) {
      return db.select(summary).from(files).where(and(eq(files.ownerId, userId), eq(files.status, "ready")));
    },

    async purgePending() {
      return purgeStale();
    },

    async totals() {
      const [row] = await db
        .select({ files: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint`, users: sql<number>`count(distinct ${files.ownerId})::int` })
        .from(files)
        .where(eq(files.status, "ready"));
      return { files: row?.files ?? 0, bytes: Number(row?.bytes ?? 0), users: row?.users ?? 0 };
    },
  };
}
