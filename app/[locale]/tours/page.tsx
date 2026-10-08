import { IntentLink } from "@/product/components/intent-link";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPublicEnv } from "@/bootstrap/env";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { TourListingFromUrl } from "@/product/components/tour-listing-url";
import { getProductContent } from "@/product/content";
import { DESTINATIONS } from "@/product/tours/catalog";
import { getPublicTours } from "@/app/_lib/tours";

type Props = { params: Promise<{ locale: Locale }> };

// Static (edge-cached), regenerated when a tour is published (tag "tours"); the filters apply in the browser.
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getProductContent(locale).tours;
  // Filtered variants share the canonical /tours (createMetadata sets it).
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), { title: c.title, description: c.subtitle, path: "/tours", locale, image: "/tours/halong-1.jpg" });
}

/** All tours with filters (?destination=&duration=&price=&type=&sort=), links to each destination page. */
export default async function ToursPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getProductContent(locale);
  const tours = (await getPublicTours()).list(locale);

  return (
    <Container className="py-12">
      <h1 className="font-heading type-h1">{c.tours.title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{c.tours.subtitle}</p>
      <nav aria-label={c.home.destinationsTitle} className="mt-6 flex gap-2 overflow-x-auto pb-1 text-sm">
        {DESTINATIONS.map((d) => (
          <IntentLink key={d} href={localePath(locale, `/tours/${d}`)} className="whitespace-nowrap rounded-full border border-border px-4 py-1.5 hover:bg-muted">
            {c.destinations[d].name}
          </IntentLink>
        ))}
      </nav>
      <div className="mt-8">
        <TourListingFromUrl locale={locale} tours={tours} />
      </div>
    </Container>
  );
}
