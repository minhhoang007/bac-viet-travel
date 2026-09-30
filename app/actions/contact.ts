"use server";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ContactResult } from "@/core/contact";
import { getContainer } from "@/bootstrap/container";

/** Thin action: module guard → client key → service (validation + rate limit + send live in the service). */
export async function submitContact(_prev: ContactResult | null, formData: FormData): Promise<ContactResult> {
  const { contact } = getContainer();
  if (!contact) notFound(); // email module off → no endpoint

  const h = await headers();
  const clientKey = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return contact.submit(Object.fromEntries(formData), clientKey);
}
