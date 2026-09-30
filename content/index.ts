import type { Locale } from "@/config/app";
import type { MarketingContent } from "./types";
import { marketing as vi } from "./vi/marketing";
import { marketing as en } from "./en/marketing";

const marketing: Record<Locale, MarketingContent> = { vi, en };

export function getMarketingContent(locale: Locale): MarketingContent {
  return marketing[locale];
}

export type { MarketingContent };
