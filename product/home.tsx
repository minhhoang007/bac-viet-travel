import type { Locale } from "@/config/app";

/*
 * A project can also export `ProductHomePage({ locale })` to replace the whole home page body (hero included);
 * the page metadata still comes from content/<locale>/marketing.ts.
 */

/**
 * Product sections rendered on the home page, after the starter's Features block (project-owned).
 * Return null to show only the starter marketing blocks.
 */
export function ProductHomeSections({ locale }: { locale: Locale }) {
  void locale;
  return null;
}
