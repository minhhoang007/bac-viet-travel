// Under a blog post (ProductPostFooter): the tours for the destinations the post is tagged with, then an offer to
// ask by chat. A post with no destination tag gets the featured tours.
import { MessagesSquare } from "lucide-react";
import type { Locale } from "@/config/app";
import { telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { localePath } from "@/core/i18n/routing";
import { currentCompany } from "@/app/_lib/company";
import { getPublicTours } from "@/app/_lib/tours";
import { getProductContent } from "../content";
import { formatPrice } from "../tours/format";
import { DESTINATIONS, isDestination } from "../tours/model";
import { BlogTourClicks } from "./blog-tour-clicks";
import { TourCard } from "./tour-card";
import { PostShare } from "./post-share";
import { getSeoSite } from "@/bootstrap/seo";
import { localizedUrl } from "@/core/seo";

export async function PostFooter({ locale, tags, post, title }: { locale: Locale; tags: string[]; post: string; title: string }) {
  const c = getProductContent(locale);
  const catalog = await getPublicTours();
  const destinations = tags.filter(isDestination);
  const matching = destinations.length ? DESTINATIONS.filter((d) => destinations.includes(d)).flatMap((d) => catalog.list(locale, { destination: d })) : catalog.featured(locale);
  const tours = (matching.length ? matching : catalog.list(locale)).slice(0, 3);
  const co = await currentCompany();
  const chat = locale === "vi" ? { href: zaloUrl(co.zalo), label: c.contact.zalo } : { href: whatsappUrl(c.contact.whatsappText(), co.whatsapp), label: c.contact.whatsapp };
  const b = c.blogFooter;

  return (
    <BlogTourClicks post={post}>
      <PostShare url={localizedUrl(getSeoSite(), locale, `/blog/${post}`)} title={title} t={b.share} />
      {tours.length > 0 && (
        <section className="mt-16 border-t border-border pt-10" aria-labelledby="post-tours" data-testid="post-tours">
          <h2 id="post-tours" className="font-heading type-h3">
            {destinations.length ? b.tours : b.popular}
          </h2>
          <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {tours.map((t) => (
              <TourCard
                key={t.slug}
                slug={t.slug}
                href={localePath(locale, `/tours/${t.slug}`)}
                image={t.images[0]!}
                title={t.title}
                summary={t.summary}
                duration={c.tours.days(t.days, t.nights)}
                destination={c.destinations[t.destination].name}
                price={formatPrice(t, locale)}
                fromLabel={c.tours.from}
                perPersonLabel={c.tours.perPerson}
                sizes="(min-width: 1024px) 240px, (min-width: 640px) 50vw, 100vw"
              />
            ))}
          </div>
        </section>
      )}
      <aside className="mt-12 flex flex-col gap-4 rounded-lg border border-border bg-muted p-6 sm:flex-row sm:items-center sm:justify-between" data-testid="post-ask">
        <div>
          <p className="font-semibold">{b.askTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{b.askText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={chat.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <MessagesSquare className="size-4" aria-hidden="true" />
            {chat.label}
          </a>
          <a href={telUrl(co.hotline)} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-background">
            {co.hotline}
          </a>
        </div>
      </aside>
    </BlogTourClicks>
  );
}
