import type { AccountDataExporter } from "@/core/account";
import type { Locale } from "@/config/app";
import type { Db } from "@/db/client";
import type { ProductContext, ProductJobs } from "@/core/product/context";
import { createNotesService } from "./_example-notes/service";

/**
 * The only file bootstrap/ imports from product/. Declares product services, menu and account-data exporters.
 * `ctx` gives services the database, logger, mail, rate limiter, payments and jobs (core/product/context.ts).
 * `pnpm init:project` replaces the example-notes entries with an empty manifest.
 */
export function createProduct(db: Db, ctx: ProductContext) {
  void ctx;
  const notes = createNotesService(db);

  const exporters: AccountDataExporter[] = [{ name: "notes", export: (userId) => notes.list(userId) }];

  // Background work (needs the jobs module): { handlers: { "notes.x": fn }, periodic: { "notes.sweep": fn } }.
  const jobs: ProductJobs = {};

  return { services: { notes }, exporters, jobs };
}

export interface ProductNavItem {
  href: string;
  label: Record<Locale, string>;
}

/** Dashboard menu entries for product pages (href without locale prefix). */
export const productNav: ProductNavItem[] = [
  { href: "/dashboard/product/notes", label: { vi: "Ghi chú", en: "Notes" } },
];

/** Admin menu entries for product pages (e.g. "/admin/orders"); shown when the admin module is on. */
export const productAdminNav: ProductNavItem[] = [];

export type Product = ReturnType<typeof createProduct>;

/** Public product pages for sitemap.xml (paths without locale prefix). The notes example is private: none. */
export const sitemapPaths: string[] = [];
