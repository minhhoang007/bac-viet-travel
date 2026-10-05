import type { Locale } from "@/config/app";
import { telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { fontVariables } from "./brand/fonts";
import { ContactButtons } from "./components/contact-buttons";
import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";
import { getProductContent } from "./content";

/** Brand fonts (Be Vietnam Pro, Playfair Display headings), applied on <html> by the starter layout. */
export const productFontVariables = fontVariables;

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
