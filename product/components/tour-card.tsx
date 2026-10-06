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
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm transition hover:shadow-md">
      <a href={p.href} className="relative block aspect-[4/3] overflow-hidden">
        <Image src={p.image} alt={p.title} fill priority={p.priority} sizes={p.sizes ?? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} className="object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium">{p.destination}</span>
      </a>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs text-muted-foreground">{p.duration}</p>
        <h3 className="mt-1 text-lg font-semibold">
          <a href={p.href} className="hover:underline">
            {p.title}
          </a>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{p.summary}</p>
        <p className="mt-4 text-sm">
          {p.fromLabel} <span className="text-lg font-bold text-primary">{p.price}</span> <span className="text-muted-foreground">{p.perPersonLabel}</span>
        </p>
      </div>
    </article>
  );
}
