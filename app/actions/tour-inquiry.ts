"use server";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getContainer } from "@/bootstrap/container";
import { getEnv } from "@/bootstrap/env";
import { clientKeyFrom } from "@/app/_lib/client-ip";
import { createMemoryRateLimiter } from "@/core/security/rate-limit";
import { features } from "@/config/features";
import { getTours } from "@/app/_lib/tours";
import { createInquiryService, type InquiryResult, type InquiryService } from "@/product/tours/inquiry";

// Same budget as the starter contact form: 5 requests / 10 minutes per client (per instance).
const limiter = createMemoryRateLimiter({ max: 5, windowMs: 10 * 60_000 });
let service: InquiryService | undefined;

/** Thin action: email module guard → client key → inquiry service (validation, rate limit, emails). */
export async function submitTourInquiry(_prev: InquiryResult | null, formData: FormData): Promise<InquiryResult> {
  if (!features.email) notFound();
  const { mail, logger } = getContainer();
  service ??= createInquiryService({
    mail,
    logger,
    rateLimiter: limiter,
    to: getEnv().extra.CONTACT_TO_EMAIL!,
    tourTitles: async (locale) => (await getTours()).list(locale).map((t) => t.title),
  });
  return service.submit(Object.fromEntries(formData), clientKeyFrom(await headers()));
}
