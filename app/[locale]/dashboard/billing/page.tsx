import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getContainer } from "@/bootstrap/container";
import { requirePageUser } from "@/app/_lib/session";
import { openPolarPortal, startPolarCheckout, startVnpayPayment } from "@/app/actions/billing";
import type { Locale } from "@/config/app";
import { billingConfig } from "@/config/billing";
import { getAppContent } from "@/content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ checkout?: string; error?: string }> };

const money = (amount: number, currency: "USD" | "VND", locale: Locale) =>
  new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(
    currency === "USD" ? amount / 100 : amount,
  );

export default async function BillingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { checkout, error } = await searchParams;
  setRequestLocale(locale);
  const { user } = await requirePageUser(locale);
  const { billing, entitlements } = getContainer();
  if (!billing || !entitlements) notFound();

  const c = getAppContent(locale).billing;
  const access = await entitlements.getAccess(user.id);
  const pro = billingConfig.plans.pro;
  const hidden = (interval: "month" | "year") => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="interval" value={interval} />
    </>
  );
  const button = "h-10 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted";

  return (
    <div className="grid max-w-2xl gap-8">
      <h1 className="text-2xl font-bold">{c.title}</h1>
      {checkout === "success" && (
        <p role="status" className="rounded-md border border-border p-3 text-sm">
          {c.checkoutSuccess}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-red-600/40 p-3 text-sm text-red-600">
          {c.error}
        </p>
      )}

      <section className="rounded-lg border border-border p-5">
        <p className="text-sm text-muted-foreground">{c.currentPlan}</p>
        <p className="mt-1 text-xl font-semibold" data-testid="current-plan">
          {billingConfig.plans[access.plan].name[locale]}
        </p>
        {access.endsAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            {c.activeUntil}: {access.endsAt.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}
            {access.source === "polar_subscription" && ` · ${c.renewsAutomatically}`}
          </p>
        )}
        {access.source === "polar_subscription" && (
          <form action={openPolarPortal} className="mt-4">
            {hidden("month")}
            <button type="submit" className={button}>
              {c.manage}
            </button>
          </form>
        )}
      </section>

      {pro.prices && (
        <section className="grid gap-6">
          <h2 className="text-lg font-semibold">{c.upgradeTitle}</h2>
          {billing.providers.includes("polar") && access.source !== "polar_subscription" && (
            <div>
              <p className="text-sm font-medium">{c.payInternational}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {(["month", "year"] as const).map((interval) => (
                  <form key={interval} action={startPolarCheckout}>
                    {hidden(interval)}
                    <button type="submit" className={button}>
                      {interval === "month" ? c.monthly : c.yearly} · {money(pro.prices!.usd[interval], "USD", locale)}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}
          {billing.providers.includes("vnpay") && (
            <div>
              <p className="text-sm font-medium">{c.payVietnam}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.vietnamNote}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {(["month", "year"] as const).map((interval) => (
                  <form key={interval} action={startVnpayPayment}>
                    {hidden(interval)}
                    <button type="submit" className={button}>
                      {interval === "month" ? c.monthly : c.yearly} · {money(pro.prices!.vnd[interval], "VND", locale)}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
