import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb } from "@/tests/integration/setup/db";
import { signIn, testApp } from "@/tests/integration/setup/app";

const handle = testDb();
const t = testApp(handle.db);
const notes = t.app.product.notes;

beforeEach(() => resetDb(handle.db));
afterAll(() => handle.close());

async function twoUsers() {
  const a = await t.app.auth.requireUser(await signIn(t, "a@example.com"));
  const b = await t.app.auth.requireUser(await signIn(t, "b@example.com"));
  return { a, b };
}

describe("example notes (vertical slice)", () => {
  it("owner can create, read, update and delete", async () => {
    const { a } = await twoUsers();
    const note = await notes.create(a.id, { title: "  Hello ", body: "World" });
    expect(note).toMatchObject({ ownerId: a.id, title: "Hello", body: "World" });

    expect(await notes.list(a.id)).toHaveLength(1);
    expect(await notes.update(a.id, note.id, { title: "Hi" })).toMatchObject({ title: "Hi", body: "" });
    await notes.remove(a.id, note.id);
    expect(await notes.list(a.id)).toEqual([]);
  });

  it("IDOR: user B cannot see, read, update or delete user A's note", async () => {
    const { a, b } = await twoUsers();
    const note = await notes.create(a.id, { title: "Private" });

    expect(await notes.list(b.id)).toEqual([]);
    await expect(notes.get(b.id, note.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(notes.update(b.id, note.id, { title: "Hacked" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(notes.remove(b.id, note.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(await notes.get(a.id, note.id)).toMatchObject({ title: "Private" });
  });

  it("rejects invalid input and malformed ids", async () => {
    const { a } = await twoUsers();
    await expect(notes.create(a.id, { title: "" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(notes.create(a.id, { title: "x".repeat(201) })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(notes.get(a.id, "not-a-uuid")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
