import Image from "next/image";
import type { Locale } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { DESTINATIONS, type Destination } from "./tours/model";
import { telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { loadDashboard } from "@/app/_lib/dashboard";
import { currentTheme } from "@/app/_lib/theme";
import { AdminDashboard } from "./components/admin-dashboard";
import type { ProductTheme } from "@/components/ui/theme";
import { fontVariables } from "./brand/fonts";
import { themeColors } from "./theme/themes";
import { ContactButtons } from "./components/contact-buttons";
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
export async function ProductAdminOverview({ locale }: { locale: Locale }) {
  const { data, tourTitle } = await loadDashboard(locale);
  return <AdminDashboard locale={locale} data={data} tourTitle={tourTitle} />;
}

/** Replaces the starter header: logo, destinations menu, hotline, "Book a tour". */
export function ProductHeader({ locale }: { locale: Locale }) {
  return <SiteHeader locale={locale} />;
}

/** Replaces the starter footer: one footer with the company's legal block, tours, company pages and policies. */
export function ProductFooter({ locale }: { locale: Locale }) {
  return <SiteFooter locale={locale} />;
}

/** Floating quick-contact buttons on every page. */
export function ProductLayoutExtras({ locale }: { locale: Locale }) {
  const c = getProductContent(locale).contact;
  const zalo = { key: "zalo" as const, label: c.zalo, href: zaloUrl() };
  const whatsapp = { key: "whatsapp" as const, label: c.whatsapp, href: whatsappUrl(c.whatsappText()) };
  const call = { key: "call" as const, label: c.call, href: telUrl() };
  // Vietnamese visitors: Zalo first. International visitors: WhatsApp first.
  const items = locale === "vi" ? [zalo, whatsapp, call] : [whatsapp, zalo, call];
  return <ContactButtons label={c.title} items={items} />;
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
          <a key={d} href={localePath(locale, `/tours/${d}`)} className="group relative block aspect-[4/3] overflow-hidden">
            <Image src={NOT_FOUND_IMAGE[d]} alt="" fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-4 font-semibold text-white">{c.destinations[d].name}</span>
          </a>
        ))}
      </div>
      <p className="mt-6 text-center">
        <a href={localePath(locale, "/tours")} className="font-medium text-primary underline underline-offset-4">
          {c.notFound.search} →
        </a>
      </p>
    </div>
  );
}
