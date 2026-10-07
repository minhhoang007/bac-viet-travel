import type { Metadata } from "next";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { submitFeedback } from "@/app/actions/feedback";
import { getFeedback } from "@/app/_lib/booking";
import { getTours } from "@/app/_lib/tours";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/app";
import { contactConfig } from "@/config/contact";
import { formatDay, getBookingContent } from "@/product/booking/content";
import { isSold } from "@/product/booking/lifecycle";

type Props = { params: Promise<{ locale: Locale; code: string }>; searchParams: Promise<{ s?: string; done?: string; error?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getBookingContent((await params).locale).feedback.title, robots: { index: false, follow: false } };
}

/** Post-trip feedback (E4), from the signed link in the feedback email: stars and a comment, once per booking. */
export default async function FeedbackPage({ params, searchParams }: Props) {
  await connection();
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = getBookingContent(locale).feedback;
  const { s = "", done, error } = await searchParams;
  const found = (await getFeedback()?.find(code, s)) ?? null;
  if (!found || !isSold(found.booking.status)) {
    return (
      <Container className="max-w-xl py-16">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-4" data-feedback="not-found">
          {t.notFound}
        </p>
      </Container>
    );
  }
  const { booking, departure, feedback } = found;
  const tour = (await getTours()).get(locale, departure.tourSlug);
  const review = contactConfig.googleReviewUrl;

  if (feedback) {
    return (
      <Container className="max-w-xl py-16">
        <h1 className="text-2xl font-semibold">{t.thanksTitle}</h1>
        <p className="mt-3" data-feedback="saved">
          {done ? t.thanks : t.already}
        </p>
        {feedback.rating >= 4 && review && (
          <p className="mt-6 rounded-xl bg-muted p-5 text-sm">
            {t.reviewAsk}{" "}
            <a href={review} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4" data-testid="google-review">
              {t.reviewLink}
            </a>
          </p>
        )}
      </Container>
    );
  }

  return (
    <Container className="max-w-xl py-12">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="mt-2 text-muted-foreground">
        {tour?.title ?? departure.tourSlug} · <span className="capitalize">{formatDay(departure.date, locale)}</span>
      </p>
      <form action={submitFeedback} className="mt-6 grid gap-5" data-testid="feedback-form">
        <input type="hidden" name="code" value={booking.code} />
        <input type="hidden" name="s" value={s} />
        <input type="hidden" name="locale" value={locale} />
        <fieldset>
          <legend className="font-medium">{t.rating}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {[5, 4, 3, 2, 1].map((n) => (
              <label key={n} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                <input type="radio" name="rating" value={n} required className="accent-primary" />
                <span aria-hidden="true">{"★".repeat(n)}</span>
                <span className="text-sm">{t.stars[n as 1 | 2 | 3 | 4 | 5]}</span>
              </label>
            ))}
          </div>
          {error === "rating" && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {t.ratingRequired}
            </p>
          )}
        </fieldset>
        <label className="grid gap-1">
          <span className="font-medium">{t.comment}</span>
          <textarea name="comment" rows={5} maxLength={2000} className="rounded-md border border-border bg-background p-3 text-sm" />
        </label>
        <Button type="submit" className="w-fit" data-testid="feedback-send">
          {t.send}
        </Button>
        <p className="text-xs text-muted-foreground">{t.private}</p>
      </form>
    </Container>
  );
}
