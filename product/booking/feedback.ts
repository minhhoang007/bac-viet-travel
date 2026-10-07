import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Logger } from "@/core/logger";
import type { MailMessage, MailPort } from "@/core/ports/mail";
import type { Db } from "@/db/client";
import { bookings, departures, tripFeedback, type Booking, type Departure, type TripFeedback } from "../schema/booking";
import { addDays, vietnamToday } from "./rules";

/** Feedback emails go out this many days after the departure date (covers tours up to 3 days), for 30 days. */
export const FEEDBACK_AFTER_DAYS = 3;
const FEEDBACK_WINDOW_DAYS = 30;
const CODE = /^BV-[A-Z2-9]{6}$/;

export type FeedbackSubmitResult = { status: "saved"; rating: number } | { status: "invalid"; field: "rating" | "comment" } | { status: "not_found" } | { status: "already" };

export interface FeedbackService {
  /** Private feedback link of a booking: the code plus an HMAC of it (the guest's own token is never stored). */
  link(code: string, locale: string): string;
  /** The booking behind a feedback link, or null when the signature does not match. */
  find(code: string, signature: string): Promise<{ booking: Booking; departure: Departure; feedback: TripFeedback | null } | null>;
  submit(code: string, signature: string, raw: Record<string, unknown>): Promise<FeedbackSubmitResult>;
  /** Periodic: emails a feedback link to guests whose trip has ended (once per booking). Returns how many. */
  sendRequests(): Promise<number>;
  forBooking(bookingId: string): Promise<TripFeedback | null>;
}

export function createFeedbackService(deps: {
  db: Db;
  logger: Logger;
  mail: MailPort;
  /** Server secret for the link signatures (at least 32 characters). */
  secret: () => string;
  siteUrl: () => string;
  tourTitle: (slug: string, locale: string) => Promise<string>;
  now?: () => Date;
}): FeedbackService {
  const { db, logger } = deps;
  const now = deps.now ?? (() => new Date());
  const sign = (code: string) => createHmac("sha256", deps.secret()).update(`trip-feedback:${code}`).digest("base64url").slice(0, 32);
  const valid = (code: string, signature: string) => {
    if (!CODE.test(code) || signature.length !== 32) return false;
    return timingSafeEqual(Buffer.from(sign(code)), Buffer.from(signature));
  };
  const link = (code: string, locale: string) => `${deps.siteUrl()}${locale === "en" ? "/en" : ""}/feedback/${code}?s=${sign(code)}`;

  async function find(code: string, signature: string) {
    if (!valid(code, signature)) return null;
    const [row] = await db.select({ booking: bookings, departure: departures }).from(bookings).innerJoin(departures, eq(departures.id, bookings.departureId)).where(eq(bookings.code, code));
    if (!row) return null;
    const [feedback] = await db.select().from(tripFeedback).where(eq(tripFeedback.bookingId, row.booking.id));
    return { ...row, feedback: feedback ?? null };
  }

  const email = (b: Booking, title: string): MailMessage =>
    b.locale === "en"
      ? {
          kind: "booking_feedback",
          to: b.email,
          subject: `How was ${title}?`,
          text: [`Hello ${b.name},`, ``, `Thank you for travelling with us on ${title}. Could you tell us how it went? It takes one minute:`, link(b.code, "en"), ``, `Your answers go to our team only.`].join("\n"),
        }
      : {
          kind: "booking_feedback",
          to: b.email,
          subject: `Chuyến ${title} của bạn thế nào?`,
          text: [`Chào ${b.name},`, ``, `Cảm ơn bạn đã đi ${title} cùng Bắc Việt Travel. Bạn cho chúng tôi biết cảm nhận nhé, chỉ mất một phút:`, link(b.code, "vi"), ``, `Ý kiến của bạn chỉ gửi tới đội ngũ của chúng tôi.`].join("\n"),
        };

  return {
    link,
    find,

    async submit(code, signature, raw) {
      const found = await find(code, signature);
      if (!found || (found.booking.status !== "deposit_paid" && found.booking.status !== "confirmed")) return { status: "not_found" };
      if (found.feedback) return { status: "already" };
      const rating = Number(raw.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { status: "invalid", field: "rating" };
      const comment = String(raw.comment ?? "").trim();
      if (comment.length > 2000) return { status: "invalid", field: "comment" };
      const inserted = await db.insert(tripFeedback).values({ bookingId: found.booking.id, rating, comment }).onConflictDoNothing().returning({ id: tripFeedback.id });
      if (inserted.length === 0) return { status: "already" };
      logger.info("booking.feedback_saved", { code, rating });
      return { status: "saved", rating };
    },

    async sendRequests() {
      const today = vietnamToday(now());
      // Claim first, then send: a crash may skip one email but never sends twice.
      const claimed = await db
        .update(bookings)
        .set({ feedbackRequestedAt: now() })
        .where(
          and(
            inArray(bookings.status, ["deposit_paid", "confirmed"]),
            isNull(bookings.feedbackRequestedAt),
            eq(bookings.guestEmails, true),
            sql`${bookings.email} <> ''`,
            inArray(
              bookings.departureId,
              db
                .select({ id: departures.id })
                .from(departures)
                .where(and(lte(departures.date, addDays(today, -FEEDBACK_AFTER_DAYS)), gte(departures.date, addDays(today, -FEEDBACK_WINDOW_DAYS)))),
            ),
          ),
        )
        .returning();
      for (const b of claimed) {
        const [d] = await db.select({ tourSlug: departures.tourSlug }).from(departures).where(eq(departures.id, b.departureId));
        await deps.mail.send(email(b, await deps.tourTitle(d!.tourSlug, b.locale))).catch((error) => logger.error("booking.email_failed", { code: b.code, kind: "booking_feedback", error }));
      }
      if (claimed.length) logger.info("booking.feedback_requested", { count: claimed.length });
      return claimed.length;
    },

    async forBooking(bookingId) {
      const [row] = await db.select().from(tripFeedback).where(eq(tripFeedback.bookingId, bookingId));
      return row ?? null;
    },
  };
}
