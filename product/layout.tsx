import type { Locale } from "@/config/app";

/**
 * Site-wide product UI rendered after the footer on every page (project-owned): e.g. floating chat buttons,
 * a licence line, a cookie notice. Return null for none.
 */
export function ProductLayoutExtras({ locale }: { locale: Locale }) {
  void locale;
  return null;
}

/*
 * Optional: export ProductHeader({ locale }) to replace the starter header (logo, menus, call-to-action).
 * Optional: export productFontVariables = [sans.variable, heading.variable].join(" ") from next/font, with
 *   variable: "--brand-font-sans" / "--brand-font-heading" (headings h1–h3 use the heading font).
 * Optional: export ProductFooter({ locale }) to replace the starter footer entirely (one footer with your own columns,
 * legal block and policy links). Keep the terms and privacy links in it.
 * Optional: export ProductNotFound({ locale }) to add content under the 404 message (e.g. popular pages).
 * Optional: export ProductAdminOverview({ locale }) (may be async) to draw the top of /admin (admins only): a business
 *   dashboard in place of the manifest's `adminOverview` figures.
 * Optional: export async productTheme(): Promise<ProductTheme | null> (components/ui/theme) to pick the theme at run
 *   time, e.g. from an admin setting: { colors, name } (name → <html data-theme> for per-theme CSS). Cache the load
 *   (unstable_cache with a tag) and revalidate the tag when it changes; null or any error falls back to brand.colors.
 */
