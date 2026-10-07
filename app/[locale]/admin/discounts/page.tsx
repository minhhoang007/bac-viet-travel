import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { createDiscount, setDiscountActive } from "@/app/actions/discounts";
import { getTours } from "@/app/_lib/tours";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/app";
import { vietnamToday } from "@/product/booking/rules";
import { formatVnd } from "@/product/booking/content";
import { getDiscountAdminContent } from "@/product/booking/discount-content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string; field?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDiscountAdminContent((await params).locale).title };
}

const input = "h-9 rounded-md border border-border bg-background px-2 text-sm";

/** Discount codes (D6): create, see live uses, turn off. Admins only; every change is audited. */
export default async function DiscountsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireAdmin();
  const rows = await container.app!.product.discounts.list();
  const tours = (await getTours()).list(locale);
  const c = getDiscountAdminContent(locale);
  const { result, field } = await searchParams;
  const today = vietnamToday(new Date());
  const hidden = <input type="hidden" name="locale" value={locale} />;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{c.title}</h1>
      {result && (
        <p role="status" className={`rounded-md border p-3 text-sm ${result === "done" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
          {result === "done" ? c.result.done : result === "taken" ? c.result.taken : result === "invalid" ? c.result.invalid(c.fields[field as keyof typeof c.fields] ?? field ?? "") : c.result.failed}
        </p>
      )}

      <form action={createDiscount} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4" data-testid="discount-form">
        {hidden}
        <p className="font-semibold sm:col-span-4">{c.add}</p>
        <label className="grid gap-1 text-sm">
          {c.fields.code}
          <input name="code" required maxLength={30} className={`${input} uppercase`} placeholder="TET2027" />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.kind}
          <select name="kind" className={input} defaultValue="percent">
            <option value="percent">{c.kinds.percent}</option>
            <option value="amount">{c.kinds.amount}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.value}
          <input name="value" required inputMode="numeric" className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.tourSlug}
          <select name="tourSlug" className={input} defaultValue="">
            <option value="">{c.allTours}</option>
            {tours.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.validFrom}
          <input type="date" name="validFrom" required defaultValue={today} className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.validTo}
          <input type="date" name="validTo" required className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.minTotalVnd}
          <input name="minTotalVnd" inputMode="numeric" className={input} placeholder="0" />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.maxUses}
          <input name="maxUses" inputMode="numeric" className={input} placeholder={c.unlimited} />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-3">
          {c.fields.note}
          <input name="note" maxLength={200} className={input} />
        </label>
        <div className="flex items-end">
          <Button type="submit" data-testid="discount-create">
            {c.create}
          </Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.empty}</p>
      ) : (
        <table className="w-full text-sm" data-testid="discounts">
          <thead className="text-left text-muted-foreground">
            <tr>
              {c.cols.map((h) => (
                <th key={h} className="py-2 pr-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-border" data-discount={d.code}>
                <td className="py-2 pr-3 font-mono font-semibold">{d.code}</td>
                <td className="py-2 pr-3">{d.kind === "percent" ? `${d.value}%` : formatVnd(d.value, locale)}</td>
                <td className="py-2 pr-3">
                  {d.validFrom} → {d.validTo}
                </td>
                <td className="py-2 pr-3">{d.tourSlug ? (tours.find((t) => t.slug === d.tourSlug)?.title ?? d.tourSlug) : c.allTours}</td>
                <td className="py-2 pr-3" data-testid="discount-used">
                  {d.used}
                  {d.maxUses !== null && ` / ${d.maxUses}`}
                </td>
                <td className="py-2 pr-3">{!d.active ? c.status.off : d.validTo < today ? c.status.ended : c.status.on}</td>
                <td className="py-2 pr-3">
                  <form action={setDiscountActive}>
                    {hidden}
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="active" value={d.active ? "0" : "1"} />
                    <Button type="submit" variant="outline" className="h-8 px-3" aria-label={`${d.active ? c.disable : c.enable} ${d.code}`}>
                      {d.active ? c.disable : c.enable}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
