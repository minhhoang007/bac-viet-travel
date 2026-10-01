import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { BOOKING_COOKIE, getDeposits } from "@/app/_lib/booking";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getBookingContent } from "@/product/booking/content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getBookingContent(locale).booking.returnTitle, robots: { index: false, follow: false } };
}

/** VNPay return URL: display only (the IPN decides). Sends the guest back to their booking page when we can. */
export default async function BookingReturnPage({ params, searchParams }: Props) {
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);
  const t = getBookingContent(locale).booking;
  const query = Object.fromEntries(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string"));
  const result = await getDeposits().returnStatus(query);

  if (result.valid && result.code) {
    const token = (await cookies()).get(BOOKING_COOKIE(result.code))?.value;
    if (token) redirect(localePath(locale, `/booking/${result.code}?t=${encodeURIComponent(token)}&pay=${result.status}`));
  }

  return (
    <Container className="max-w-2xl py-16">
      <h1 className="text-2xl font-bold">{t.returnTitle}</h1>
      <p className="mt-4" data-return={result.valid ? result.status : "invalid"}>
        {!result.valid ? t.returnInvalid : result.status === "failed" ? t.payFailed : result.code ? t.returnNoLink(result.code) : t.returnInvalid}
      </p>
    </Container>
  );
}
