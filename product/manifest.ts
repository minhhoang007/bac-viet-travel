import type { AccountDataExporter } from "@/core/account";
import type { Locale } from "@/config/app";
import type { Db } from "@/db/client";

/** The only file bootstrap/ imports from product/. Declares product services, menu and account-data exporters. */
export function createProduct(db: Db) {
  void db; // pass it to your product services
  const exporters: AccountDataExporter[] = [];
  return { services: {}, exporters };
}

export interface ProductNavItem {
  href: string;
  label: Record<Locale, string>;
}

/** Dashboard menu entries for product pages (href without locale prefix). */
export const productNav: ProductNavItem[] = [];

/** Public product pages for sitemap.xml (paths without locale prefix). */
export const sitemapPaths: string[] = [];

export type Product = ReturnType<typeof createProduct>;
