import type { AccountDataExporter } from "@/core/account";
import type { NavItem } from "@/core/module";
import type { Db } from "@/db/client";
import { createNotesService } from "./_example-notes/service";

/**
 * The only file bootstrap/ imports from product/. Declares product services, menu and account-data exporters.
 * Replace the example-notes entries when starting a real project.
 */
export function createProduct(db: Db) {
  const notes = createNotesService(db);

  const exporters: AccountDataExporter[] = [{ name: "notes", export: (userId) => notes.list(userId) }];

  return { services: { notes }, exporters };
}

/** Dashboard menu for product pages (label keys resolve in content/<locale>/app.ts). */
export const productNav: (NavItem & { labelKey: "notes" })[] = [
  { label: "Notes", labelKey: "notes", href: "/dashboard/product/notes" },
];

export type Product = ReturnType<typeof createProduct>;
