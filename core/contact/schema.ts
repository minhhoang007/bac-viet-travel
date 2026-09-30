import { z } from "zod";

/** Field error codes; the UI maps them to localized text from content/. */
export type ContactFieldError = "required" | "invalid_email" | "too_long";

export const contactSchema = z.object({
  name: z.string().trim().min(1, "required").max(100, "too_long"),
  email: z.string().trim().min(1, "required").max(200, "too_long").pipe(z.email("invalid_email")),
  message: z.string().trim().min(1, "required").max(5000, "too_long"),
  /** Honeypot: humans leave it empty. */
  website: z.string().max(0).optional().default(""),
});

export type ContactInput = z.infer<typeof contactSchema>;
