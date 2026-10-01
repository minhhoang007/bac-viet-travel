import type { Locale } from "@/config/app";

/**
 * Site-wide product UI rendered after the footer on every page (project-owned): e.g. floating chat buttons,
 * a licence line, a cookie notice. Return null for none.
 */
export function ProductLayoutExtras({ locale }: { locale: Locale }) {
  void locale;
  return null;
}
