// A tour inside a blog post (`<Tour slug="ha-long-cruise-2d1n" />` in the Markdown): photo, name, length and price
// next to the paragraph that talks about the place, not only at the end. An unknown or unpublished tour shows nothing.
import Image from "next/image";
import type { Locale } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { getPublicTours } from "@/app/_lib/tours";
import { isHotlinked } from "../media/unsplash";
import { getProductContent } from "../content";
import { formatPrice } from "../tours/format";
import { BlogTourClicks } from "./blog-tour-clicks";

export async function PostTourEmbed({ locale, slug, post }: { locale: Locale; slug: string; post: string }) {
  const tour = (await getPublicTours()).list(locale).find((t) => t.slug === slug);
  if (!tour) return null;
  const c = getProductContent(locale);
  const image = tour.images[0]!;
  return (
    <BlogTourClicks post={post}>
      <a
        href={localePath(locale, `/tours/${tour.slug}`)}
        className="not-prose my-8 grid grid-cols-[7rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-background no-underline transition-colors hover:border-primary/60 sm:grid-cols-[12rem_minmax(0,1fr)]"
        data-testid="post-tour-embed"
      >
        <span className="relative min-h-28">
          <Image src={image} alt="" fill sizes="12rem" unoptimized={isHotlinked(image)} className="object-cover" />
        </span>
        <span className="grid content-center gap-1 p-4">
          <span className="text-xs text-muted-foreground">
            {c.destinations[tour.destination].name} · {c.tours.days(tour.days, tour.nights)}
          </span>
          <span className="font-semibold text-foreground">{tour.title}</span>
          <span className="text-sm text-muted-foreground">
            {c.tours.from} <span className="font-semibold text-foreground">{formatPrice(tour, locale)}</span> {c.tours.perPerson}
          </span>
          <span className="text-sm font-medium text-primary">{c.blogFooter.seeTour} →</span>
        </span>
      </a>
    </BlogTourClicks>
  );
}
