"use server";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getContainer } from "@/bootstrap/container";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import { features } from "@/config/features";
import type { InquiryResult } from "@/product/tours/inquiry";

/** Thin action: email module guard → client key → inquiry service (validation, shared rate limit, emails). */
export async function submitTourInquiry(_prev: InquiryResult | null, formData: FormData): Promise<InquiryResult> {
  const inquiry = getContainer().app?.product.inquiry;
  if (!features.email || !inquiry) notFound();
  return inquiry.submit(Object.fromEntries(formData), clientKeyFrom(await headers()));
}
