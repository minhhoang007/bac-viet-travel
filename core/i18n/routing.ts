import { defineRouting } from "next-intl/routing";
import { appConfig } from "@/config/app";

// Default locale has no prefix ("/"), others are prefixed ("/en").
export const routing = defineRouting({
  locales: appConfig.locales,
  defaultLocale: appConfig.defaultLocale,
  localePrefix: "as-needed",
  // No redirect by Accept-Language: "/" is always the default locale (better for SEO, predictable URLs).
  localeDetection: false,
});

export function localePath(locale: string, path = "/"): string {
  const clean = path === "/" ? "" : path;
  return locale === routing.defaultLocale ? clean || "/" : `/${locale}${clean}`;
}
