import { IntentLink } from "./intent-link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { isHotlinked } from "../media/unsplash";
import { ViewTransition } from "react";

export interface TourCardProps {
  href: string;
  image: string;
  title: string;
  summary: string;
  duration: string;
  destination: string;
  price: string;
  fromLabel: string;
  perPersonLabel: string;
  /** The first card of a list is often the largest image on screen (LCP): load it first, not lazily. */
  priority?: boolean;
  /** next/image sizes for the grid it sits in. */
  sizes?: string;
  /** Tour slug: the photo grows into the tour page's first photo on the way there (tourPhotoTransition). */
  slug: string;
  /** A short notice under the price (e.g. no departure on the searched day). */
  note?: string;
  /** "View tour" beside the price (the whole card stays one link target: photo and title). */
  viewLabel?: string;
}

/** Shared name of a tour's card photo and its tour page's first photo (one per page: a tour has one card per list). */
export const tourPhotoTransition = (slug: string) => `tour-photo-${slug}`;

export function TourCard(p: TourCardProps) {
  return (
    // Editorial card ("Sơn Mài"): a hairline above, the photo, small capitals, the title in the heading serif.
    <article className="group flex flex-col border-t border-border pt-5">
      <ViewTransition name={tourPhotoTransition(p.slug)} share="tour-photo" default="none">
        <IntentLink href={p.href} className="relative block aspect-[3/2] overflow-hidden">
          <Image src={p.image} alt={p.title} fill unoptimized={isHotlinked(p.image)} priority={p.priority} sizes={p.sizes ?? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} className="object-cover transition duration-700 group-hover:scale-[1.03]" />
        </IntentLink>
      </ViewTransition>
      <div className="flex flex-1 flex-col pt-5">
        <p className="type-label text-muted-foreground">
          {p.destination} · {p.duration}
        </p>
        <h3 className="mt-2 font-heading type-h3">
          <IntentLink href={p.href} className="hover:text-primary">
            {p.title}
          </IntentLink>
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 type-body text-muted-foreground sm:line-clamp-3">{p.summary}</p>
        <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border pt-4">
          <p className="type-small text-muted-foreground">
            {p.fromLabel} <span className="text-lg font-medium text-foreground" data-price>
              {p.price}
            </span> {p.perPersonLabel}
          </p>
          {p.viewLabel && (
            // Decorative repeat of the title link (screen readers already have it): hidden from them, out of tab order.
            <IntentLink href={p.href} tabIndex={-1} aria-hidden="true" className="type-label inline-flex shrink-0 items-center gap-1.5 text-primary">
              {p.viewLabel}
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </IntentLink>
          )}
        </div>
        {p.note && (
          <p className="mt-1 type-small font-medium text-foreground" data-tour-note>
            {p.note}
          </p>
        )}
      </div>
    </article>
  );
}
