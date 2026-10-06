import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { users } from "@/core/users/schema";
import { createLogger } from "@/core/logger";
import type { MailMessage } from "@/core/ports/mail";
import { createContentModule } from "@/modules/content";
import { resetDb, testDb } from "./setup/db";

const { db, close } = testDb();
const logger = createLogger({ write: () => {} });
let clock = new Date("2026-10-05T03:00:00Z");
const sent: MailMessage[] = [];
const changed: string[] = [];
const content = createContentModule({
  db,
  logger,
  types: ["tour"],
  mail: { send: async (m) => void sent.push(m) },
  adminUrl: (item) => `https://site.test/admin/tours/${item.id}`,
  onChange: (item) => void changed.push(item.id),
  now: () => clock,
});

let editor: { id: string };
let admin: { id: string };
beforeEach(async () => {
  await resetDb(db);
  sent.length = 0;
  changed.length = 0;
  clock = new Date("2026-10-05T03:00:00Z");
  const [e] = await db.insert(users).values({ email: "editor@example.com", role: "editor" }).returning();
  const [a] = await db.insert(users).values({ email: "admin@example.com", role: "admin" }).returning();
  editor = { id: e!.id };
  admin = { id: a!.id };
});
afterAll(() => close());

const draft = () => content.create(editor, { type: "tour", slug: "ha-long", data: { title: "Hạ Long" } });

describe("content workflow", () => {
  it("draft → submit (admins emailed) → approve publishes; visitors see only the live copy", async () => {
    const item = await draft();
    expect(await content.getBySlug("tour", "ha-long")).toBeNull();
    expect((await content.getBySlug("tour", "ha-long", { draft: true }))?.data).toEqual({ title: "Hạ Long" });

    const pending = await content.submit(editor, item.id, item.revision);
    expect(pending.status).toBe("pending");
    expect(sent.map((m) => [m.kind, m.to])).toEqual([["content_review", "admin@example.com"]]);
    expect(sent[0]!.text).toContain(`/admin/tours/${item.id}`);

    const live = await content.approve(admin, item.id, { revision: pending.revision });
    expect(live.status).toBe("published");
    expect(changed).toEqual([item.id]);
    expect(await content.listPublished("tour")).toMatchObject([{ slug: "ha-long", data: { title: "Hạ Long" } }]);
    expect((await content.versions(item.id)).map((v) => v.event)).toEqual(["published", "submitted"]);
  });

  it("editing a live item keeps the live copy (and its URL) until the change is published", async () => {
    const item = await draft();
    const live = await content.approve(admin, item.id, { revision: item.revision });
    const edited = await content.saveDraft(editor, item.id, { revision: live.revision, slug: "vinh-ha-long", data: { title: "Vịnh Hạ Long" } });
    expect(edited.status).toBe("draft");
    expect(await content.getBySlug("tour", "ha-long")).toMatchObject({ slug: "ha-long", data: { title: "Hạ Long" } });
    expect(await content.getBySlug("tour", "vinh-ha-long")).toBeNull();
    // The old live slug stays reserved: another item cannot take it.
    await expect(content.create(editor, { type: "tour", slug: "ha-long", data: {} })).rejects.toMatchObject({ code: "CONFLICT" });

    await content.approve(admin, item.id, { revision: edited.revision });
    expect(await content.getBySlug("tour", "vinh-ha-long")).toMatchObject({ data: { title: "Vịnh Hạ Long" } });
    expect(await content.getBySlug("tour", "ha-long")).toBeNull();
  });

  it("rejects a stale revision (two people editing) with CONFLICT", async () => {
    const item = await draft();
    await content.saveDraft(editor, item.id, { revision: item.revision, slug: "ha-long", data: { title: "A" } });
    await expect(content.saveDraft(admin, item.id, { revision: item.revision, slug: "ha-long", data: { title: "B" } })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await content.get(item.id))?.draft).toEqual({ title: "A" });
  });

  it("reject sends the draft back to the author with the note", async () => {
    const item = await draft();
    const pending = await content.submit(editor, item.id, item.revision);
    sent.length = 0;
    const back = await content.reject(admin, item.id, { revision: pending.revision, note: "Thiếu giá tour riêng" });
    expect(back).toMatchObject({ status: "draft", reviewNote: "Thiếu giá tour riêng" });
    expect(sent.map((m) => [m.kind, m.to])).toEqual([["content_rejected", "editor@example.com"]]);
    // Only drafts can be submitted; a pending item cannot be rejected twice.
    await expect(content.reject(admin, item.id, { revision: back.revision, note: "" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("scheduled approval publishes on the jobs tick at the chosen time", async () => {
    const item = await draft();
    const pending = await content.submit(editor, item.id, item.revision);
    const scheduled = await content.approve(admin, item.id, { revision: pending.revision, publishAt: new Date("2026-10-06T01:00:00Z") });
    expect(scheduled.status).toBe("approved");
    expect(await content.publishDue()).toBe(0);
    clock = new Date("2026-10-06T01:00:01Z");
    expect(await content.publishDue()).toBe(1);
    expect(await content.getBySlug("tour", "ha-long")).not.toBeNull();
    expect(changed).toEqual([item.id]);
  });

  it("editing an approved draft cancels the schedule (it must be reviewed again)", async () => {
    const item = await draft();
    const scheduled = await content.approve(admin, item.id, { revision: item.revision, publishAt: new Date("2026-10-06T01:00:00Z") });
    await content.saveDraft(editor, item.id, { revision: scheduled.revision, slug: "ha-long", data: { title: "changed" } });
    clock = new Date("2026-10-07T00:00:00Z");
    expect(await content.publishDue()).toBe(0);
    expect(await content.getBySlug("tour", "ha-long")).toBeNull();
  });

  it("hide takes the live copy offline; delete needs it hidden first", async () => {
    const item = await draft();
    const live = await content.approve(admin, item.id, { revision: item.revision });
    await expect(content.remove(admin, item.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const hidden = await content.setHidden(admin, item.id, { revision: live.revision, hidden: true });
    expect(await content.getBySlug("tour", "ha-long")).toBeNull();
    expect(await content.listPublished("tour")).toEqual([]);
    expect(changed).toEqual([item.id, item.id]);
    await content.remove(admin, hidden.id);
    expect(await content.get(item.id)).toBeNull();
  });

  it("restore copies a snapshot back into the draft", async () => {
    const item = await draft();
    const live = await content.approve(admin, item.id, { revision: item.revision });
    const edited = await content.saveDraft(editor, item.id, { revision: live.revision, slug: "ha-long", data: { title: "oops" } });
    const [version] = await content.versions(item.id);
    const restored = await content.restore(editor, item.id, { revision: edited.revision, versionId: version!.id });
    expect(restored).toMatchObject({ status: "draft", draft: { title: "Hạ Long" } });
  });

  it("validates type, slug and size; a version of another item cannot be restored", async () => {
    await expect(content.create(editor, { type: "post", slug: "x", data: {} })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(content.create(editor, { type: "tour", slug: "Hạ Long", data: {} })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(content.create(editor, { type: "tour", slug: "big", data: { x: "a".repeat(600_000) } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const a = await draft();
    const b = await content.create(editor, { type: "tour", slug: "sa-pa", data: {} });
    const pa = await content.submit(editor, a.id, a.revision);
    const [va] = await content.versions(a.id);
    expect(pa.status).toBe("pending");
    await expect(content.restore(editor, b.id, { revision: b.revision, versionId: va!.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("an incomplete item cannot be submitted, approved or scheduled (the project's validate)", async () => {
    const strict = createContentModule({ db, logger, types: ["tour"], adminUrl: () => "", validate: (_type, data) => (data.title ? [] : ["title"]) });
    const item = await strict.create(editor, { type: "tour", slug: "ha-long", data: {} });
    await expect(strict.submit(editor, item.id, item.revision)).rejects.toMatchObject({ code: "VALIDATION_ERROR", details: { problems: ["title"] } });
    await expect(strict.approve(admin, item.id, { revision: item.revision })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(strict.approve(admin, item.id, { revision: item.revision, publishAt: new Date("2026-10-06T01:00:00Z") })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await strict.get(item.id)).toMatchObject({ status: "draft", published: null });
    const fixed = await strict.saveDraft(editor, item.id, { revision: item.revision, slug: "ha-long", data: { title: "Hạ Long" } });
    expect((await strict.submit(editor, item.id, fixed.revision)).status).toBe("pending");
  });

  it("a failed email does not undo the submit", async () => {
    const failing = createContentModule({ db, logger, types: ["tour"], mail: { send: async () => { throw new Error("smtp down"); } }, adminUrl: () => "" });
    const item = await failing.create(editor, { type: "tour", slug: "ha-long", data: {} });
    expect((await failing.submit(editor, item.id, item.revision)).status).toBe("pending");
  });

  it("publish and submit are atomic with their snapshot: a failed snapshot changes nothing", async () => {
    const item = await draft();
    await db.execute(sql`CREATE FUNCTION fail_snapshot() RETURNS trigger AS $f$ BEGIN RAISE EXCEPTION 'snapshot failed'; END $f$ LANGUAGE plpgsql`);
    await db.execute(sql`CREATE TRIGGER fail_snapshot BEFORE INSERT ON content_versions FOR EACH ROW EXECUTE FUNCTION fail_snapshot()`);
    try {
      await expect(content.approve(admin, item.id, { revision: item.revision })).rejects.toThrow();
      await expect(content.submit(editor, item.id, item.revision)).rejects.toThrow();
      expect(await content.get(item.id)).toMatchObject({ status: "draft", published: null, revision: item.revision });
      expect(await content.getBySlug("tour", "ha-long")).toBeNull();
      expect(changed).toEqual([]);
      expect(sent).toEqual([]);
    } finally {
      await db.execute(sql`DROP TRIGGER fail_snapshot ON content_versions`);
      await db.execute(sql`DROP FUNCTION fail_snapshot()`);
    }
  });

  it("delete is refused when the item is shown again between the check and the delete", async () => {
    const item = await draft();
    const live = await content.approve(admin, item.id, { revision: item.revision });
    await content.setHidden(admin, item.id, { revision: live.revision, hidden: true });
    // Another admin shows it again right after remove() read it: run that update just before the DELETE executes.
    const racing = new Proxy(db, {
      get(target, key, receiver) {
        if (key !== "delete") return Reflect.get(target, key, receiver);
        return (table: Parameters<typeof db.delete>[0]) => ({
          where: (where: Parameters<ReturnType<typeof db.delete>["where"]>[0]) => ({
            returning: async (columns: Record<string, never>) => {
              await db.execute(sql`UPDATE content_items SET hidden = false, revision = revision + 1 WHERE id = ${item.id}`);
              return target.delete(table).where(where).returning(columns);
            },
          }),
        });
      },
    });
    const racer = createContentModule({ db: racing, logger, types: ["tour"], adminUrl: () => "" });
    await expect(racer.remove(admin, item.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await content.getBySlug("tour", "ha-long")).not.toBeNull();
  });
});
