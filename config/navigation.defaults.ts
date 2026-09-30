// Starter-owned. Projects override in config/navigation.ts (ADR-0004).
import type { Locale } from "./app";

export interface NavLink {
  /** Path without locale prefix; may include a hash, e.g. "/#faq". */
  href: string;
  label: Record<Locale, string>;
}

/** Links in the public site header. */
export const siteNavigationDefaults: NavLink[] = [
  { href: "/#features", label: { vi: "Tính năng", en: "Features" } },
  { href: "/#faq", label: { vi: "Hỏi đáp", en: "FAQ" } },
  { href: "/#contact", label: { vi: "Liên hệ", en: "Contact" } },
];
