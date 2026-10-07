import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { createManualBooking } from "@/app/actions/booking-admin";
import { requirePermission } from "@/app/_lib/staff";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getBookingAdminContent } from "@/product/booking/admin-content";
import { addDays, vietnamToday } from "@/product/booking/rules";
import { ManualBookingForm } from "@/product/components/manual-booking-form";
import { getTours } from "@/app/_lib/tours";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getBookingAdminContent(locale).manual.title };
}

/** Staff entry for bookings paid outside the website (phone, Zalo, OTA such as Klook). */
export default async function NewManualBookingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requirePermission("bookings.edit");
  const c = getBookingAdminContent(locale);
  const today = vietnamToday(new Date());
  const tours = (await getTours()).list(locale);
  const title = (slug: string) => tours.find((t) => t.slug === slug)?.title ?? slug;
  const rows = await container.app!.product.bookingAdmin.listDepartures({ from: today, to: addDays(today, 180) });
  const departures = rows
    .filter((d) => d.status === "open")
    .map((d) => {
      const seatsLeft = Math.max(0, d.capacity - d.sold - d.held);
      return { id: d.id, seatsLeft, label: `${d.date} · ${title(d.tourSlug)} · ${seatsLeft}/${d.capacity}` };
    });

  return (
    <div className="grid gap-6">
      <a href={localePath(locale, "/admin/bookings")} className="text-sm text-muted-foreground hover:underline">
        {c.detail.back}
      </a>
      <h1 className="text-2xl font-bold">{c.manual.title}</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{c.manual.intro}</p>
      <ManualBookingForm locale={locale} departures={departures} action={createManualBooking} />
    </div>
  );
}
