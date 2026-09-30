import type { AccountDataExporter } from "@/core/account";
import type { Locale } from "@/config/app";
import type { Db } from "@/db/client";
import { createNotesService } from "./_example-notes/service";

/**
 * The only file bootstrap/ imports from product/. Declares product services, menu and account-data exporters.
 * `pnpm init:project` replaces the example-notes entries with an empty manifest.
 */
export function createProduct(db: Db) {
  const notes = createNotesService(db);

  const exporters: AccountDataExporter[] = [{ name: "notes", export: (userId) => notes.list(userId) }];

  return { services: { notes }, exporters };
}

export interface ProductNavItem {
  href: string;
  label: Record<Locale, string>;
}

/** Dashboard menu entries for product pages (href without locale prefix). */
export const productNav: ProductNavItem[] = [
  { href: "/dashboard/product/notes", label: { vi: "Ghi chú", en: "Notes" } },
];

export type Product = ReturnType<typeof createProduct>;

/** Public product pages for sitemap.xml (paths without locale prefix). The notes example is private: none. */
export const sitemapPaths: string[] = [];
