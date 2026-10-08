import { IntentLink } from "./intent-link";
import Image from "next/image";

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
}

export function TourCard(p: TourCardProps) {
  return (
    // Editorial card ("Sơn Mài"): a hairline above, the photo, small capitals, the title in the heading serif.
    <article className="group flex flex-col border-t border-border pt-5">
      <IntentLink href={p.href} className="relative block aspect-[3/2] overflow-hidden">
        <Image src={p.image} alt={p.title} fill priority={p.priority} sizes={p.sizes ?? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} className="object-cover transition duration-700 group-hover:scale-[1.03]" />
      </IntentLink>
      <div className="flex flex-1 flex-col pt-5">
        <p className="type-label text-muted-foreground">
          {p.destination} · {p.duration}
        </p>
        <h3 className="mt-2 font-heading type-h3">
          <IntentLink href={p.href} className="hover:text-primary">
            {p.title}
          </IntentLink>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 type-body text-muted-foreground">{p.summary}</p>
        <p className="mt-4 type-small text-muted-foreground">
          {p.fromLabel} <span className="text-lg font-medium text-foreground" data-price>
            {p.price}
          </span> {p.perPersonLabel}
        </p>
      </div>
    </article>
  );
}
