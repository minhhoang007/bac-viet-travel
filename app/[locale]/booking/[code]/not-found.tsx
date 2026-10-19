import { useLocale } from "next-intl";
import { resendBookingLink } from "@/app/actions/booking";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/app";
import { getBookingContent } from "@/product/booking/content";
import { ResendLinkForm } from "@/product/components/resend-link-form";

/**
 * Unknown booking or wrong link token: HTTP 404, with the booking page's own hint (open the link from the email),
 * and a way to get a new link by email when the old one is lost.
 */
export default function BookingNotFound() {
  const t = getBookingContent(useLocale() as Locale);
  return (
    <Container className="max-w-2xl py-16">
      <h1 className="text-2xl font-bold">{t.booking.title}</h1>
      <p className="mt-4" data-booking="not-found">
        {t.booking.notFound}
      </p>
      <ResendLinkForm action={resendBookingLink} labels={t.resend} />
    </Container>
  );
}
