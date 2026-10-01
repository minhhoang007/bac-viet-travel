import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getPublicEnv } from "@/bootstrap/env";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { createMetadata } from "@/core/seo";
import { seoSite } from "@/core/seo/site";
import type { Locale } from "@/config/app";
import { TourCard } from "@/product/components/tour-card";
import { getProductContent } from "@/product/content";
import { DESTINATIONS, getTourCatalog } from "@/product/tours/catalog";
import { formatPrice } from "@/product/tours/format";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getProductContent(locale).tours;
  return createMetadata(seoSite(getPublicEnv().NEXT_PUBLIC_SITE_URL), { title: c.title, description: c.subtitle, path: "/tours", locale, image: "/tours/halong-1.jpg" });
}

/** All tours, grouped by destination (each group has an anchor: /tours#sapa). */
export default async function ToursPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getProductContent(locale);
  const catalog = getTourCatalog();

  return (
    <Container className="py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{c.tours.title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{c.tours.subtitle}</p>
      <nav aria-label={c.home.destinationsTitle} className="sticky top-0 z-10 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-background/95 px-4 py-3 text-sm backdrop-blur">
        {DESTINATIONS.map((d) => (
          <a key={d} href={`#${d}`} className="whitespace-nowrap rounded-full border border-border px-4 py-1.5 hover:bg-muted">
            {c.destinations[d].name}
          </a>
        ))}
      </nav>
      {DESTINATIONS.map((d) => {
        const tours = catalog.list(locale, { destination: d });
        if (tours.length === 0) return null;
        return (
          <section key={d} id={d} className="scroll-mt-20 pt-10" data-destination={d}>
            <h2 className="text-2xl font-semibold">{c.destinations[d].name}</h2>
            <p className="mt-1 text-muted-foreground">{c.destinations[d].tagline}</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tours.map((t) => (
                <TourCard
                  key={t.slug}
                  href={localePath(locale, `/tours/${t.slug}`)}
                  image={t.images[0]!}
                  title={t.title}
                  summary={t.summary}
                  duration={c.tours.days(t.days, t.nights)}
                  destination={c.destinations[t.destination].name}
                  price={formatPrice(t, locale)}
                  fromLabel={c.tours.from}
                  perPersonLabel={c.tours.perPerson}
                />
              ))}
            </div>
          </section>
        );
      })}
    </Container>
  );
}
