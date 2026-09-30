import type { Locale } from "@/config/app";
import type { AppContent } from "./app-types";
import type { MarketingContent } from "./types";
import { app as appEn } from "./en/app";
import { marketing as marketingEn } from "./en/marketing";
import { app as appVi } from "./vi/app";
import { marketing as marketingVi } from "./vi/marketing";

const marketing: Record<Locale, MarketingContent> = { vi: marketingVi, en: marketingEn };
const app: Record<Locale, AppContent> = { vi: appVi, en: appEn };

export function getMarketingContent(locale: Locale): MarketingContent {
  return marketing[locale];
}

export function getAppContent(locale: Locale): AppContent {
  return app[locale];
}

export type { MarketingContent, AppContent };
