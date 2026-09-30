import { and, desc, eq } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { Db } from "@/db/client";
import { notes, type Note } from "./schema";
import { noteIdSchema, noteInputSchema } from "./validations";

/**
 * Example vertical slice. Every query is scoped by ownerId (anti-IDOR):
 * another user's note is indistinguishable from a missing one (NOT_FOUND).
 */
export interface NotesService {
  list(ownerId: string): Promise<Note[]>;
  get(ownerId: string, id: string): Promise<Note>;
  create(ownerId: string, input: unknown): Promise<Note>;
  update(ownerId: string, id: string, input: unknown): Promise<Note>;
  remove(ownerId: string, id: string): Promise<void>;
}

export function createNotesService(db: Db): NotesService {
  const parseId = (id: string) => {
    const parsed = noteIdSchema.safeParse(id);
    if (!parsed.success) throw new AppError("NOT_FOUND");
    return parsed.data;
  };
  const parseInput = (input: unknown) => {
    const parsed = noteInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Invalid note", { details: { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.message })) } });
    }
    return parsed.data;
  };
  const owned = (ownerId: string, id: string) => and(eq(notes.id, parseId(id)), eq(notes.ownerId, ownerId));

  return {
    list: (ownerId) => db.select().from(notes).where(eq(notes.ownerId, ownerId)).orderBy(desc(notes.createdAt)),

    async get(ownerId, id) {
      const [note] = await db.select().from(notes).where(owned(ownerId, id));
      if (!note) throw new AppError("NOT_FOUND");
      return note;
    },

    async create(ownerId, input) {
      const [note] = await db.insert(notes).values({ ...parseInput(input), ownerId }).returning();
      return note!;
    },

    async update(ownerId, id, input) {
      const [note] = await db.update(notes).set(parseInput(input)).where(owned(ownerId, id)).returning();
      if (!note) throw new AppError("NOT_FOUND");
      return note;
    },

    async remove(ownerId, id) {
      const deleted = await db.delete(notes).where(owned(ownerId, id)).returning({ id: notes.id });
      if (deleted.length === 0) throw new AppError("NOT_FOUND");
    },
  };
}
