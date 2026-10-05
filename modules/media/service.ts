import { and, count, desc, eq, ilike, lt } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { Logger } from "@/core/logger";
import type { Db } from "@/db/client";
import type { MediaProvider } from "./ports";
import { mediaAssets, type MediaAssetRow } from "./schema";

export type MediaAsset = Pick<MediaAssetRow, "id" | "publicId" | "version" | "format" | "width" | "height" | "bytes" | "name" | "alt" | "focalX" | "focalY" | "createdAt">;

export interface ImageProps {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

export interface MediaConfig {
  /** Folder (Cloudinary) / prefix for every image of this project. */
  folder: string;
  allowedFormats: readonly string[];
  maxBytes: number;
}

export interface MediaModule {
  config: MediaConfig;
  origins: MediaProvider["origins"];
  /** Reserves a row and returns the signed upload: the browser posts the file straight to the provider. */
  requestUpload(actor: { id: string }, input: { name: string }): Promise<{ id: string; url: string; fields: Record<string, string> }>;
  /**
   * After the browser upload: reads what the provider stored and checks format and size here (never trusting the
   * browser). Anything else is destroyed and VALIDATION_ERROR thrown.
   */
  confirmUpload(id: string): Promise<MediaAsset>;
  list(options?: { query?: string; page?: number; pageSize?: number }): Promise<{ rows: MediaAsset[]; total: number }>;
  get(id: string): Promise<MediaAsset | null>;
  /** Several images in the given order (unknown or pending ids are skipped). */
  getMany(ids: readonly string[]): Promise<MediaAsset[]>;
  update(id: string, input: { alt?: Record<string, string>; focalX?: number; focalY?: number }): Promise<MediaAsset>;
  /** CONFLICT while the project reports the image in use (a live tour must not lose its photo). */
  remove(id: string): Promise<void>;
  /** Responsive image: `srcSet` in width steps, cropped to `aspect` (width/height) around the focal point. */
  imageProps(asset: MediaAsset, options?: { aspect?: number; widths?: readonly number[] }): ImageProps;
  /** Periodic: uploads signed but never confirmed. */
  purgePending(): Promise<number>;
}

export interface MediaDeps {
  db: Db;
  logger: Logger;
  provider: MediaProvider;
  config: MediaConfig;
  /** Project hook (manifest `mediaInUse`): true when the image is used by live content. */
  inUse?: (id: string) => Promise<boolean>;
  now?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PENDING_TTL_MS = 60 * 60_000;
const DEFAULT_WIDTHS = [320, 640, 960, 1280, 1920] as const;
const columns = {
  id: mediaAssets.id,
  publicId: mediaAssets.publicId,
  version: mediaAssets.version,
  format: mediaAssets.format,
  width: mediaAssets.width,
  height: mediaAssets.height,
  bytes: mediaAssets.bytes,
  name: mediaAssets.name,
  alt: mediaAssets.alt,
  focalX: mediaAssets.focalX,
  focalY: mediaAssets.focalY,
  createdAt: mediaAssets.createdAt,
};

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const cleanName = (name: string) => name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);

export function createMediaModule(deps: MediaDeps): MediaModule {
  const { db, logger, provider, config } = deps;
  const now = deps.now ?? (() => new Date());

  const ready = (id: string) => and(eq(mediaAssets.id, id), eq(mediaAssets.status, "ready"));

  return {
    config,
    origins: provider.origins,

    async requestUpload(actor, { name }) {
      // Random provider id (not the file name): nothing guessable, nothing to escape.
      const publicId = `${config.folder}/${crypto.randomUUID()}`;
      const [row] = await db.insert(mediaAssets).values({ publicId, name: cleanName(name), uploadedBy: actor.id }).returning({ id: mediaAssets.id });
      return { id: row!.id, ...provider.signUpload({ publicId, allowedFormats: config.allowedFormats }) };
    },

    async confirmUpload(id) {
      if (!UUID.test(id)) throw new AppError("NOT_FOUND");
      const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
      if (!row) throw new AppError("NOT_FOUND");
      if (row.status === "ready") return row;
      const stored = await provider.fetch(row.publicId);
      const reason = !stored ? "missing" : !config.allowedFormats.includes(stored.format) ? "format" : stored.bytes > config.maxBytes ? "size" : null;
      if (reason || !stored) {
        if (stored) await provider.destroy(row.publicId);
        await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
        logger.warn("media.upload_rejected", { id, reason });
        throw new AppError("VALIDATION_ERROR", reason === "size" ? "Image too large" : reason === "format" ? "Image type not allowed" : "Upload did not complete");
      }
      const [updated] = await db
        .update(mediaAssets)
        .set({ status: "ready", width: stored.width, height: stored.height, format: stored.format, bytes: stored.bytes, version: stored.version })
        .where(eq(mediaAssets.id, id))
        .returning(columns);
      logger.info("media.uploaded", { id, bytes: stored.bytes });
      return updated!;
    },

    async list({ query, page = 1, pageSize = 48 } = {}) {
      const q = query?.trim().slice(0, 100);
      const where = q ? and(eq(mediaAssets.status, "ready"), ilike(mediaAssets.name, like(q))) : eq(mediaAssets.status, "ready");
      const size = Math.min(Math.max(pageSize, 1), 100);
      const rows = await db.select(columns).from(mediaAssets).where(where).orderBy(desc(mediaAssets.createdAt)).limit(size).offset((Math.max(page, 1) - 1) * size);
      const [{ total }] = (await db.select({ total: count() }).from(mediaAssets).where(where)) as [{ total: number }];
      return { rows, total };
    },

    async get(id) {
      if (!UUID.test(id)) return null;
      const [row] = await db.select(columns).from(mediaAssets).where(ready(id));
      return row ?? null;
    },

    async getMany(ids) {
      const valid = ids.filter((id) => UUID.test(id));
      if (valid.length === 0) return [];
      const rows = await Promise.all(valid.map(async (id) => (await db.select(columns).from(mediaAssets).where(ready(id)))[0]));
      return rows.filter((r): r is MediaAsset => Boolean(r));
    },

    async update(id, input) {
      if (!UUID.test(id)) throw new AppError("NOT_FOUND");
      const alt = input.alt && Object.fromEntries(Object.entries(input.alt).map(([k, v]) => [k.slice(0, 10), String(v).trim().slice(0, 300)]));
      const [row] = await db
        .update(mediaAssets)
        .set({
          ...(alt && { alt }),
          ...(input.focalX !== undefined && { focalX: clamp01(input.focalX) }),
          ...(input.focalY !== undefined && { focalY: clamp01(input.focalY) }),
        })
        .where(ready(id))
        .returning(columns);
      if (!row) throw new AppError("NOT_FOUND");
      return row;
    },

    async remove(id) {
      if (!UUID.test(id)) throw new AppError("NOT_FOUND");
      const [row] = await db.select({ publicId: mediaAssets.publicId }).from(mediaAssets).where(eq(mediaAssets.id, id));
      if (!row) throw new AppError("NOT_FOUND");
      if (await deps.inUse?.(id)) throw new AppError("CONFLICT", "Image is in use");
      // Image first: a failed provider delete keeps the row, so nothing is orphaned silently.
      await provider.destroy(row.publicId);
      await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
    },

    imageProps(asset, { aspect, widths = DEFAULT_WIDTHS } = {}) {
      const ratio = aspect ?? (asset.height > 0 ? asset.width / asset.height : 1.5);
      const focal = { x: asset.focalX, y: asset.focalY };
      // Never upscale beyond the original width.
      const steps = [...new Set(widths.map((w) => Math.min(w, asset.width || w)))].sort((a, b) => a - b);
      const at = (w: number) => provider.url(asset, { width: w, height: aspect ? Math.round(w / ratio) : undefined, focal });
      const largest = steps.at(-1)!;
      return {
        src: at(largest),
        srcSet: steps.map((w) => `${at(w)} ${w}w`).join(", "),
        width: largest,
        height: Math.round(largest / ratio),
      };
    },

    async purgePending() {
      const stale = await db
        .select({ id: mediaAssets.id, publicId: mediaAssets.publicId })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.status, "pending"), lt(mediaAssets.createdAt, new Date(now().getTime() - PENDING_TTL_MS))))
        .limit(100);
      for (const row of stale) {
        try {
          if (row.publicId) await provider.destroy(row.publicId);
          await db.delete(mediaAssets).where(eq(mediaAssets.id, row.id));
        } catch (error) {
          logger.error("media.purge_failed", { id: row.id, error });
        }
      }
      return stale.length;
    },
  };
}
