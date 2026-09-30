import { z } from "zod";

export const noteInputSchema = z.object({
  title: z.string().trim().min(1, "required").max(200, "too_long"),
  body: z.string().trim().max(10_000, "too_long").default(""),
});

export const noteIdSchema = z.uuid();

export type NoteInput = z.infer<typeof noteInputSchema>;
