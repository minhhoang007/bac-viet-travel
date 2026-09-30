"use server";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ContactResult } from "@/core/contact";
import { getContainer } from "@/bootstrap/container";
import { clientKeyFrom } from "@/app/_lib/client-ip";

/** Thin action: module guard → client key → service (validation + rate limit + send live in the service). */
export async function submitContact(_prev: ContactResult | null, formData: FormData): Promise<ContactResult> {
  const { contact } = getContainer();
  if (!contact) notFound(); // email module off → no endpoint

  return contact.submit(Object.fromEntries(formData), clientKeyFrom(await headers()));
}
