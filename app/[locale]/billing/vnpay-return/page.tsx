import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { setRequestLocale } from "next-intl/server";
import { getContainer } from "@/bootstrap/container";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string>> };

export const metadata: Metadata = { robots: { index: false } };

/** Where VNPay sends the customer back. Shows the verified order status; access is granted only by the IPN. */
export default async function VnpayReturnPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await connection();
  const { billing } = getContainer();
  if (!billing?.providers.includes("vnpay")) notFound();

  const c = getAppContent(locale).billing;
  const { valid, status } = await billing.vnpayReturnStatus(await searchParams);
  const message = !valid ? c.returnInvalid : status === "paid" ? c.returnPaid : status === "failed" ? c.returnFailed : c.returnPending;

  return (
    <Container className="max-w-xl py-16 text-center">
      <p role="status" className="text-lg" data-status={valid ? status : "invalid"}>
        {message}
      </p>
      <a href={localePath(locale, "/dashboard/billing")} className="mt-6 inline-block text-primary underline">
        {c.backToBilling}
      </a>
    </Container>
  );
}
