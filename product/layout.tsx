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
 */
