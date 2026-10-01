import { z } from "zod";
import type { Logger } from "@/core/logger";
import type { MailPort } from "@/core/ports/mail";
import type { RateLimiter } from "@/core/security/rate-limit";

/** Booking request from a tour page. The team confirms availability and price by phone / Zalo / WhatsApp / email. */
export const inquirySchema = z.object({
  tour: z.string().min(1, "required").max(120, "too_long"),
  name: z.string().trim().min(1, "required").max(100, "too_long"),
  email: z.email("invalid_email").max(200, "too_long"),
  phone: z
    .string()
    .trim()
    .min(1, "required")
    .max(30, "too_long")
    .regex(/^\+?[\d\s().-]{6,}$/, "invalid_phone"),
  /** Preferred channel for the reply. */
  channel: z.enum(["phone", "zalo", "whatsapp", "email"]).catch("email"),
  date: z.iso.date("invalid_date"),
  adults: z.coerce.number().int("invalid_number").min(1, "invalid_number").max(50, "invalid_number"),
  children: z.coerce.number().int("invalid_number").min(0, "invalid_number").max(50, "invalid_number"),
  note: z.string().max(2000, "too_long").default(""),
  locale: z.enum(["vi", "en"]).catch("vi"),
  /** Honeypot: humans never fill it. */
  website: z.string().max(0).optional(),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
export type InquiryField = Exclude<keyof InquiryInput, "website" | "locale" | "channel">;
export type InquiryError = "required" | "invalid_email" | "invalid_phone" | "invalid_date" | "invalid_number" | "too_long" | "past_date";

export type InquiryResult =
  | { status: "success" }
  | { status: "invalid"; fieldErrors: Partial<Record<InquiryField, InquiryError>> }
  | { status: "rate_limited" }
  | { status: "error" };

const ERRORS: InquiryError[] = ["required", "invalid_email", "invalid_phone", "invalid_date", "invalid_number", "too_long"];
/** User text in an email header: no control characters, bounded. */
const oneLine = (s: string) => s.replace(/[\p{Cc}\p{Cf}]+/gu, " ").trim().slice(0, 120);

const CONFIRMATION = {
  vi: (name: string, tour: string) => ({
    subject: `Đã nhận yêu cầu đặt tour: ${tour}`,
    text: `Xin chào ${name},\n\nBắc Việt Travel đã nhận yêu cầu đặt tour "${tour}". Chúng tôi sẽ liên hệ lại trong vòng 24 giờ để xác nhận lịch và giá.\n\nTrân trọng,\nBắc Việt Travel`,
  }),
  en: (name: string, tour: string) => ({
    subject: `We received your booking request: ${tour}`,
    text: `Hello ${name},\n\nThank you for your request for "${tour}". We will get back to you within 24 hours to confirm availability and price.\n\nBest regards,\nBac Viet Travel`,
  }),
};

export interface InquiryService {
  submit(raw: Record<string, unknown>, clientKey: string): Promise<InquiryResult>;
}

export function createInquiryService(deps: {
  mail: MailPort;
  rateLimiter: RateLimiter;
  /** Team inbox (CONTACT_TO_EMAIL). */
  to: string;
  logger: Logger;
  /** Known tour titles; anything else is rejected (no free text in the subject line). */
  tourTitles: (locale: string) => string[];
  today?: () => string;
}): InquiryService {
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));

  return {
    async submit(raw, clientKey) {
      if (typeof raw.website === "string" && raw.website.length > 0) {
        deps.logger.warn("inquiry.honeypot");
        return { status: "success" };
      }
      const parsed = inquirySchema.safeParse(raw);
      const fieldErrors: Partial<Record<InquiryField, InquiryError>> = {};
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] as InquiryField;
          fieldErrors[field] ??= ERRORS.find((e) => e === issue.message) ?? "required";
        }
      }
      // Checks beyond the schema run on every submission, so the visitor sees all problems at once.
      const date = typeof raw.date === "string" ? raw.date : "";
      if (!fieldErrors.date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today()) fieldErrors.date = "past_date";
      const locale = raw.locale === "en" ? "en" : "vi";
      if (!fieldErrors.tour && !deps.tourTitles(locale).includes(String(raw.tour ?? ""))) fieldErrors.tour = "required";
      if (!parsed.success || Object.keys(fieldErrors).length > 0) return { status: "invalid", fieldErrors };

      try {
        if (!(await deps.rateLimiter.limit(`inquiry:${clientKey}`)).success) return { status: "rate_limited" };
      } catch (error) {
        deps.logger.error("inquiry.rate_limit_failed", { error });
        return { status: "error" };
      }

      const d = parsed.data;
      const name = oneLine(d.name);
      try {
        await deps.mail.send({
          kind: "tour_inquiry",
          to: deps.to,
          replyTo: d.email,
          subject: `[Đặt tour] ${d.tour} · ${d.date} · ${d.adults + d.children} khách · ${name}`,
          text: [
            `Tour: ${d.tour}`,
            `Ngày khởi hành: ${d.date}`,
            `Người lớn: ${d.adults} · Trẻ em: ${d.children}`,
            `Khách: ${d.name}`,
            `Email: ${d.email}`,
            `Điện thoại: ${d.phone}`,
            `Liên hệ qua: ${d.channel}`,
            `Ngôn ngữ: ${d.locale}`,
            "",
            d.note || "(không có ghi chú)",
          ].join("\n"),
        });
      } catch (error) {
        deps.logger.error("inquiry.send_failed", { error });
        return { status: "error" };
      }
      try {
        // Fixed template to the visitor; only their name and a known tour title are inserted.
        await deps.mail.send({ kind: "tour_inquiry_confirmation", to: d.email, ...CONFIRMATION[d.locale](name, d.tour) });
      } catch (error) {
        deps.logger.warn("inquiry.confirmation_failed", { error }); // the team already has the request
      }
      return { status: "success" };
    },
  };
}
