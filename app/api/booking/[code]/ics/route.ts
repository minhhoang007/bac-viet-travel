import { getBooking } from "@/app/_lib/booking";
import { getTours } from "@/app/_lib/tours";
import { getPublicEnv } from "@/bootstrap/env";
import { contactConfig } from "@/config/contact";
import { getContainer } from "@/bootstrap/container";
import { localePath } from "@/core/i18n/routing";
import { isSold } from "@/product/booking/lifecycle";
import { addDays } from "@/product/booking/rules";

/** iCalendar text: escape \ ; , and newlines (RFC 5545 §3.3.11). */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Calendar file (D8) for a paid booking: one all-day event over the tour days. The guest's token is required. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const locale = url.searchParams.get("locale") === "en" ? "en" : "vi";
  if (!getContainer().app) return new Response("Not found", { status: 404 });
  const booking = await getBooking().getForGuest(code, token);
  if (!booking || !isSold(booking.status)) return new Response("Not found", { status: 404 });

  const tour = (await getTours()).get(locale, booking.departure.tourSlug);
  const start = booking.departure.date;
  const end = addDays(start, tour?.days ?? 1); // DTEND is exclusive for all-day events
  const ymd = (d: string) => d.replace(/-/g, "");
  const link = `${getPublicEnv().NEXT_PUBLIC_SITE_URL}${localePath(locale, `/booking/${booking.code}`)}?t=${encodeURIComponent(token)}`;
  const title = `${tour?.title ?? booking.departure.tourSlug} (${booking.code})`;
  const description = [tour ? `${locale === "en" ? "Pick-up" : "Đón khách"}: ${tour.departure}` : "", `${contactConfig.companyName} · ${contactConfig.hotline}`, link].filter(Boolean).join("\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bac Viet Travel//Booking//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${booking.code}@bacviet.travel`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(start)}`,
    `DTEND;VALUE=DATE:${ymd(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${booking.code}.ics"`,
      "cache-control": "private, no-store",
    },
  });
}
