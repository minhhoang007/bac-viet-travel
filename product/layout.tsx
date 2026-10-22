import { Suspense } from "react";
import { IntentLink } from "./components/intent-link";
import Image from "next/image";
import type { Locale } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { DESTINATIONS, type Destination } from "./tours/model";
import { telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { loadDashboard } from "@/app/_lib/dashboard";
import { currentTheme } from "@/app/_lib/theme";
import { currentCompany } from "@/app/_lib/company";
import { AdminDashboard, DashboardUnavailable } from "./components/admin-dashboard";
import type { ProductTheme } from "@/components/ui/theme";
import { fontVariables } from "./brand/fonts";
import { themeColors } from "./theme/themes";
import { ContactButtons } from "./components/contact-buttons";
import { NavigationProgress } from "./components/navigation-progress";
import { MarketingTags } from "./analytics/marketing-tags";
import { ConsentBanner } from "@/components/analytics/consent-banner";
import { getAppContent } from "@/content";
import { PostFooter } from "./components/post-footer";
import { PostTourEmbed } from "./components/post-tour-embed";
import { BlogMagazine } from "./components/blog-magazine";
import type { PostListProps } from "@/components/blog/post-list";
import { blogConfig } from "@/config/blog";
import { staffCan } from "./manifest";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { getProductContent } from "./content";

/** Brand fonts (Be Vietnam Pro, Cormorant Garamond headings), applied on <html> by the starter layout. */
export const productFontVariables = fontVariables;

/** The theme an admin picked (starter v1.16 hook): colors here, fonts and headings in product/styles.css. */
export async function productTheme(): Promise<ProductTheme> {
  const choice = await currentTheme();
  return { colors: themeColors(choice), name: choice.theme };
}

/** Business dashboard at the top of /admin (starter v1.18 hook; the page is admin-only). */
/** The starter's site figures (sign-ups, page views, storage) mean nothing to a tour company's staff: not shown. */
export const productSiteFigures = false;

/** Staff besides admins who see the business overview at /admin: managers (they have the reports already). */
export function productOverviewFor(user: { id: string; role: "user" | "editor" | "admin" }): Promise<boolean> {
  return staffCan(user, "reports");
}

export async function ProductAdminOverview({ locale }: { locale: Locale }) {
  // A failing figure must not take the whole admin overview down: say so and keep the rest of the page.
  const loaded = await loadDashboard(locale).catch(() => null);
  if (!loaded) return <DashboardUnavailable locale={locale} />;
  return <AdminDashboard locale={locale} data={loaded.data} tourTitle={loaded.tourTitle} />;
}

/** Replaces the starter header: logo, destinations menu, hotline, "Book a tour". */
export function ProductHeader({ locale }: { locale: Locale }) {
  return <SiteHeader locale={locale} />;
}

/** Replaces the starter footer: one footer with the company's legal block, tours, company pages and policies. */
export function ProductFooter({ locale }: { locale: Locale }) {
  return <SiteFooter locale={locale} />;
}

/** Under a blog post (starter hook): tours for its destination tags, then a question by chat. */
export function ProductPostFooter({ locale, tags, slug, title }: { locale: Locale; tags: string[]; slug: string; title: string }) {
  return <PostFooter locale={locale} tags={tags} post={slug} title={title} />;
}

/** Blocks inside a post (starter hook): `<Tour slug="…" />` draws that tour's card. Other names: nothing. */
export function ProductPostEmbed({ locale, name, slug, post }: { locale: Locale; name: string; slug: string; post: string }) {
  return name === "Tour" ? <PostTourEmbed locale={locale} slug={slug} post={post} /> : null;
}

/** Blog index and tag pages (starter hook): the guides as a photo magazine, with each guide's best time to go. */
export function ProductPostList({ locale, posts, featured, empty }: PostListProps) {
  // Shown only while "bestTime" is a configured quick fact (config/blog.ts), like on the post page.
  const bestTime = blogConfig.facts.find((f) => f.key === "bestTime");
  return (
    <BlogMagazine
      posts={posts.map((p) => ({ ...p, topic: p.tags[0]?.label, bestTime: bestTime ? p.facts?.bestTime : undefined }))}
      featured={featured}
      empty={empty}
      bestTimeLabel={bestTime?.label[locale] ?? ""}
    />
  );
}

/** Post editor parts (starter hook), loaded by the editor page only: public pages never pull in admin editor code. */
export const loadProductPostEditor = () => import("./blog/editor").then((m) => m.productPostEditor);

/** Page-change progress bar and the floating quick-contact buttons on every page. */
export async function ProductLayoutExtras({ locale }: { locale: Locale }) {
  const c = getProductContent(locale).contact;
  const co = await currentCompany();
  const zalo = { key: "zalo" as const, label: c.zalo, href: zaloUrl(co.zalo) };
  const whatsapp = { key: "whatsapp" as const, label: c.whatsapp, href: whatsappUrl(c.whatsappText(), co.whatsapp) };
  const call = { key: "call" as const, label: c.call, href: telUrl(co.hotline) };
  // Vietnamese visitors: Zalo first. International visitors: WhatsApp first.
  const items = locale === "vi" ? [zalo, whatsapp, call] : [whatsapp, zalo, call];
  const tags = { ga4: process.env.NEXT_PUBLIC_GA4_ID || undefined, metaPixel: process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined };
  const f = getProductContent(locale).footer;
  const { consent } = getAppContent(locale);
  return (
    <>
      {/* useSearchParams: inside Suspense so the pages stay static. */}
      <Suspense>
        <NavigationProgress />
      </Suspense>
      <ContactButtons label={c.title} items={items} />
      {tags.ga4 || tags.metaPixel ? (
        <>
          <MarketingTags ids={tags} />
          {/* The starter's banner and cookie; the analytics module (off here) would show it otherwise. */}
          <ConsentBanner
            text={f.cookieText}
            accept={consent.accept}
            decline={consent.decline}
            privacyLabel={consent.privacyLink}
            privacyHref={localePath(locale, "/privacy")}
          />
        </>
      ) : null}
    </>
  );
}

const NOT_FOUND_IMAGE: Record<Destination, string> = { "ha-long": "/tours/halong-1.jpg", "ninh-binh": "/tours/ninhbinh-1.jpg", sapa: "/tours/sapa-1.jpg" };

/** Under the 404 message (starter hook): the three destinations and all tours. Static: no database at build time. */
export function ProductNotFound({ locale }: { locale: Locale }) {
  const c = getProductContent(locale);
  return (
    <div className="mx-auto mt-10 max-w-4xl text-left" data-testid="not-found-suggestions">
      <p className="text-center text-muted-foreground">{c.notFound.text}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {DESTINATIONS.map((d) => (
          <IntentLink key={d} href={localePath(locale, `/tours/${d}`)} className="group relative block aspect-[4/3] overflow-hidden">
            <Image src={NOT_FOUND_IMAGE[d]} alt="" fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-4 font-semibold text-white">{c.destinations[d].name}</span>
          </IntentLink>
        ))}
      </div>
      <p className="mt-6 text-center">
        <IntentLink href={localePath(locale, "/tours")} className="font-medium text-primary underline underline-offset-4">
          {c.notFound.search} →
        </IntentLink>
      </p>
    </div>
  );
}
