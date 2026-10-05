import { and, count, desc, eq, inArray, isNotNull, lte, ne, or } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { Logger } from "@/core/logger";
import type { MailPort } from "@/core/ports/mail";
import { users } from "@/core/users/schema";
import type { Db } from "@/db/client";
import { contentItems, contentVersions, type ContentItemRow, type ContentStatus, type ContentVersionRow } from "./schema";

export type ContentItem = ContentItemRow;
export type ContentVersion = Pick<ContentVersionRow, "id" | "event" | "slug" | "createdBy" | "createdAt">;
export interface ContentActor {
  id: string;
}

export interface ContentModule {
  /** Content types the project registered (manifest `contentTypes`). */
  types: readonly string[];
  create(actor: ContentActor, input: { type: string; slug: string; data: Record<string, unknown> }): Promise<ContentItem>;
  get(id: string): Promise<ContentItem | null>;
  list(options?: { type?: string; status?: ContentStatus; page?: number; pageSize?: number }): Promise<{ rows: ContentItem[]; total: number }>;
  /** Live copies of a type (published and not hidden), newest first. */
  listPublished(type: string): Promise<{ id: string; slug: string; data: Record<string, unknown>; publishedAt: Date | null }[]>;
  /** The live copy by its public slug; with `draft` (Draft Mode, staff only) the working copy by its draft slug. */
  getBySlug(type: string, slug: string, options?: { draft?: boolean }): Promise<{ id: string; slug: string; data: Record<string, unknown> } | null>;
  /**
   * Saves the working copy. `revision` is the one the editor loaded: CONFLICT when someone saved in between.
   * Editing sends the item back to "draft" (a pending or approved draft must be reviewed again); the live copy stays.
   */
  saveDraft(actor: ContentActor, id: string, input: { revision: number; slug: string; data: Record<string, unknown> }): Promise<ContentItem>;
  /** draft → pending; snapshots the draft and emails the admins. */
  submit(actor: ContentActor, id: string, revision: number): Promise<ContentItem>;
  /** Admin: publishes now, or at `publishAt` (status "approved" until the jobs tick publishes it). */
  approve(actor: ContentActor, id: string, input: { revision: number; publishAt?: Date }): Promise<ContentItem>;
  /** Admin: pending/approved → draft with a note for the author (emailed). */
  reject(actor: ContentActor, id: string, input: { revision: number; note: string }): Promise<ContentItem>;
  /** Admin: takes the live copy offline or shows it again. */
  setHidden(actor: ContentActor, id: string, input: { revision: number; hidden: boolean }): Promise<ContentItem>;
  versions(id: string): Promise<ContentVersion[]>;
  /** Copies a snapshot into the working copy (status "draft"); publishing it needs review again. */
  restore(actor: ContentActor, id: string, input: { revision: number; versionId: string }): Promise<ContentItem>;
  /** Admin: deletes an item that has never been published or is hidden. */
  remove(actor: ContentActor, id: string): Promise<void>;
  /** Periodic: publishes approved items whose time has come. */
  publishDue(): Promise<number>;
}

export interface ContentDeps {
  db: Db;
  logger: Logger;
  types: readonly string[];
  mail?: MailPort;
  /** Absolute URL of the admin page for an item (links in emails). */
  adminUrl: (item: ContentItem) => string;
  /** Project hook after every publish, hide or unhide (e.g. revalidate cached pages). Errors are logged, not thrown. */
  onChange?: (item: ContentItem) => Promise<void> | void;
  now?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_JSON = 512 * 1024;
const MAX_VERSIONS = 50;

function checkData(data: Record<string, unknown>) {
  if (JSON.stringify(data).length > MAX_JSON) throw new AppError("VALIDATION_ERROR", "Content too large");
}
function checkSlug(slug: string) {
  if (slug.length > 120 || !SLUG.test(slug)) throw new AppError("VALIDATION_ERROR", "Invalid slug");
}
const isUniqueViolation = (error: unknown) => (error as { code?: string; cause?: { code?: string } })?.code === "23505" || (error as { cause?: { code?: string } })?.cause?.code === "23505";

export function createContentModule(deps: ContentDeps): ContentModule {
  const { db, logger } = deps;
  const now = deps.now ?? (() => new Date());

  const load = async (id: string) => {
    if (!UUID.test(id)) throw new AppError("NOT_FOUND");
    const [row] = await db.select().from(contentItems).where(eq(contentItems.id, id));
    if (!row) throw new AppError("NOT_FOUND");
    return row;
  };

  /** A slug may not be another item's draft slug or live slug (a renamed draft keeps its old live URL). */
  const slugFree = async (type: string, slug: string, selfId?: string) => {
    const [taken] = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(and(eq(contentItems.type, type), or(eq(contentItems.slug, slug), eq(contentItems.publishedSlug, slug)), selfId ? ne(contentItems.id, selfId) : undefined))
      .limit(1);
    if (taken) throw new AppError("CONFLICT", "Slug already used");
  };

  /** Applies a change only if nobody changed the item since `revision` (and it is in an allowed status). */
  const transition = async (id: string, revision: number, from: readonly ContentStatus[] | null, set: Partial<ContentItemRow>) => {
    const row = await load(id);
    if (row.revision !== revision) throw new AppError("CONFLICT", "Changed by someone else");
    if (from && !from.includes(row.status)) throw new AppError("CONFLICT", `Not allowed from ${row.status}`);
    const [updated] = await db
      .update(contentItems)
      .set({ ...set, revision: revision + 1 })
      .where(and(eq(contentItems.id, id), eq(contentItems.revision, revision)))
      .returning();
    if (!updated) throw new AppError("CONFLICT", "Changed by someone else");
    return updated;
  };

  const snapshot = async (item: ContentItem, event: "submitted" | "published", actorId: string | null) => {
    await db.insert(contentVersions).values({ itemId: item.id, event, slug: item.slug, data: item.draft, createdBy: actorId });
    // Keep the newest MAX_VERSIONS.
    const old = await db.select({ id: contentVersions.id }).from(contentVersions).where(eq(contentVersions.itemId, item.id)).orderBy(desc(contentVersions.createdAt)).offset(MAX_VERSIONS);
    if (old.length) await db.delete(contentVersions).where(inArray(contentVersions.id, old.map((v) => v.id)));
  };

  const changed = async (item: ContentItem) => {
    try {
      await deps.onChange?.(item);
    } catch (error) {
      logger.error("content.on_change_failed", { id: item.id, error });
    }
  };

  const notify = async (kind: string, to: string[], subject: string, text: string) => {
    if (!deps.mail || to.length === 0) return;
    for (const recipient of to) {
      try {
        await deps.mail.send({ kind, to: recipient, subject, text });
      } catch (error) {
        // Email is a courtesy: the workflow change already happened.
        logger.warn("content.notify_failed", { kind, error });
      }
    }
  };

  const publish = async (row: ContentItem, actorId: string | null) => {
    const [updated] = await db
      .update(contentItems)
      .set({ status: "published", published: row.draft, publishedSlug: row.slug, publishedAt: now(), publishAt: null, hidden: false, reviewNote: null, revision: row.revision + 1 })
      .where(and(eq(contentItems.id, row.id), eq(contentItems.revision, row.revision)))
      .returning();
    if (!updated) throw new AppError("CONFLICT", "Changed by someone else");
    await snapshot(updated, "published", actorId);
    logger.info("content.published", { id: row.id, type: row.type });
    await changed(updated);
    return updated;
  };

  return {
    types: deps.types,

    async create(actor, { type, slug, data }) {
      if (!deps.types.includes(type)) throw new AppError("VALIDATION_ERROR", "Unknown content type");
      checkSlug(slug);
      checkData(data);
      await slugFree(type, slug);
      try {
        const [row] = await db.insert(contentItems).values({ type, slug, draft: data, updatedBy: actor.id }).returning();
        logger.info("content.created", { id: row!.id, type });
        return row!;
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError("CONFLICT", "Slug already used");
        throw error;
      }
    },

    async get(id) {
      if (!UUID.test(id)) return null;
      const [row] = await db.select().from(contentItems).where(eq(contentItems.id, id));
      return row ?? null;
    },

    async list({ type, status, page = 1, pageSize = 50 } = {}) {
      const where = and(type ? eq(contentItems.type, type) : undefined, status ? eq(contentItems.status, status) : undefined);
      const size = Math.min(Math.max(pageSize, 1), 100);
      const rows = await db.select().from(contentItems).where(where).orderBy(desc(contentItems.updatedAt)).limit(size).offset((Math.max(page, 1) - 1) * size);
      const [{ total }] = (await db.select({ total: count() }).from(contentItems).where(where)) as [{ total: number }];
      return { rows, total };
    },

    async listPublished(type) {
      const rows = await db
        .select({ id: contentItems.id, slug: contentItems.publishedSlug, data: contentItems.published, publishedAt: contentItems.publishedAt })
        .from(contentItems)
        .where(and(eq(contentItems.type, type), isNotNull(contentItems.published), eq(contentItems.hidden, false)))
        .orderBy(desc(contentItems.publishedAt));
      return rows.map((r) => ({ id: r.id, slug: r.slug!, data: r.data!, publishedAt: r.publishedAt }));
    },

    async getBySlug(type, slug, { draft = false } = {}) {
      if (draft) {
        const [row] = await db.select().from(contentItems).where(and(eq(contentItems.type, type), eq(contentItems.slug, slug)));
        if (row) return { id: row.id, slug: row.slug, data: row.draft };
      }
      const [row] = await db
        .select()
        .from(contentItems)
        .where(and(eq(contentItems.type, type), eq(contentItems.publishedSlug, slug), isNotNull(contentItems.published), eq(contentItems.hidden, false)));
      return row ? { id: row.id, slug: row.publishedSlug!, data: row.published! } : null;
    },

    async saveDraft(actor, id, { revision, slug, data }) {
      checkSlug(slug);
      checkData(data);
      await slugFree((await load(id)).type, slug, id);
      try {
        const updated = await transition(id, revision, null, { draft: data, slug, status: "draft", publishAt: null, updatedBy: actor.id });
        logger.info("content.saved", { id, type: updated.type });
        return updated;
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError("CONFLICT", "Slug already used");
        throw error;
      }
    },

    async submit(actor, id, revision) {
      const updated = await transition(id, revision, ["draft"], { status: "pending", submittedBy: actor.id, reviewNote: null });
      await snapshot(updated, "submitted", actor.id);
      logger.info("content.submitted", { id, type: updated.type });
      const admins = await db.select({ email: users.email }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active")));
      await notify(
        "content_review",
        admins.map((a) => a.email),
        "Nội dung chờ duyệt / Content awaiting review",
        `Có nội dung mới chờ duyệt (${updated.type}: ${updated.slug}).\nContent awaiting review (${updated.type}: ${updated.slug}).\n\n${deps.adminUrl(updated)}`,
      );
      return updated;
    },

    async approve(actor, id, { revision, publishAt }) {
      const row = await load(id);
      if (row.revision !== revision) throw new AppError("CONFLICT", "Changed by someone else");
      // Admins may publish their own draft directly.
      if (row.status !== "pending" && row.status !== "draft") throw new AppError("CONFLICT", `Not allowed from ${row.status}`);
      if (publishAt && publishAt.getTime() > now().getTime()) {
        const updated = await transition(id, revision, ["pending", "draft"], { status: "approved", publishAt, reviewNote: null, updatedBy: actor.id });
        logger.info("content.scheduled", { id, type: row.type });
        return updated;
      }
      return publish(row, actor.id);
    },

    async reject(actor, id, { revision, note }) {
      const updated = await transition(id, revision, ["pending", "approved"], { status: "draft", publishAt: null, reviewNote: note.trim().slice(0, 2000) || null, updatedBy: actor.id });
      logger.info("content.rejected", { id, type: updated.type });
      if (updated.submittedBy) {
        const [author] = await db.select({ email: users.email }).from(users).where(eq(users.id, updated.submittedBy));
        await notify(
          "content_rejected",
          author ? [author.email] : [],
          "Nội dung cần sửa / Content needs changes",
          `Nội dung của bạn cần sửa (${updated.type}: ${updated.slug}).\nYour content needs changes (${updated.type}: ${updated.slug}).\n\n${updated.reviewNote ?? ""}\n\n${deps.adminUrl(updated)}`,
        );
      }
      return updated;
    },

    async setHidden(actor, id, { revision, hidden }) {
      const row = await load(id);
      if (!row.published) throw new AppError("CONFLICT", "Never published");
      const updated = await transition(id, revision, null, { hidden, updatedBy: actor.id });
      logger.info(hidden ? "content.hidden" : "content.shown", { id, type: row.type });
      await changed(updated);
      return updated;
    },

    async versions(id) {
      if (!UUID.test(id)) return [];
      return db
        .select({ id: contentVersions.id, event: contentVersions.event, slug: contentVersions.slug, createdBy: contentVersions.createdBy, createdAt: contentVersions.createdAt })
        .from(contentVersions)
        .where(eq(contentVersions.itemId, id))
        .orderBy(desc(contentVersions.createdAt));
    },

    async restore(actor, id, { revision, versionId }) {
      if (!UUID.test(versionId)) throw new AppError("NOT_FOUND");
      const [version] = await db.select().from(contentVersions).where(and(eq(contentVersions.id, versionId), eq(contentVersions.itemId, id)));
      if (!version) throw new AppError("NOT_FOUND");
      await slugFree((await load(id)).type, version.slug, id);
      try {
        const updated = await transition(id, revision, null, { draft: version.data, slug: version.slug, status: "draft", publishAt: null, updatedBy: actor.id });
        logger.info("content.restored", { id, type: updated.type });
        return updated;
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError("CONFLICT", "Slug already used");
        throw error;
      }
    },

    async remove(actor, id) {
      const row = await load(id);
      if (row.published && !row.hidden) throw new AppError("CONFLICT", "Hide it before deleting");
      await db.delete(contentItems).where(eq(contentItems.id, id));
      logger.info("content.deleted", { id, type: row.type, actorId: actor.id });
      if (row.published) await changed(row);
    },

    async publishDue() {
      const due = await db
        .select()
        .from(contentItems)
        .where(and(eq(contentItems.status, "approved"), lte(contentItems.publishAt, now())))
        .limit(50);
      let done = 0;
      for (const row of due) {
        try {
          await publish(row, null);
          done++;
        } catch (error) {
          logger.error("content.publish_failed", { id: row.id, error });
        }
      }
      return done;
    },
  };
}
