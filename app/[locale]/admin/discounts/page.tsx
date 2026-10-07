import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { createDiscount, setDiscountActive, updateDiscount } from "@/app/actions/discounts";
import { localePath } from "@/core/i18n/routing";
import { getTours } from "@/app/_lib/tours";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/app";
import { vietnamToday } from "@/product/booking/rules";
import { formatShortDay, formatVnd } from "@/product/booking/content";
import { getDiscountAdminContent } from "@/product/booking/discount-content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string; field?: string; edit?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDiscountAdminContent((await params).locale).title };
}

const input = "h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm";

/** Discount codes (D6): create, see live uses, turn off. Admins only; every change is audited. */
export default async function DiscountsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireAdmin();
  const rows = await container.app!.product.discounts.list();
  const tours = (await getTours()).list(locale);
  const c = getDiscountAdminContent(locale);
  const { result, field, edit } = await searchParams;
  // ?edit=<id>: the form below edits that code instead of creating one.
  const editing = rows.find((d) => d.id === edit);
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

      <form key={editing?.id ?? "new"} action={editing ? updateDiscount : createDiscount} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4 [&>*]:min-w-0" data-testid="discount-form">
        {hidden}
        {editing ? (
          <div className="sm:col-span-4">
            <input type="hidden" name="id" value={editing.id} />
            <p className="font-semibold">{c.editTitle(editing.code)}</p>
            <p className="text-sm text-muted-foreground">{c.editHint}</p>
          </div>
        ) : (
          <>
            <p className="font-semibold sm:col-span-4">{c.add}</p>
            <label className="grid gap-1 text-sm">
              {c.fields.code}
              <input name="code" required maxLength={30} className={`${input} uppercase`} placeholder="TET2027" />
            </label>
          </>
        )}
        <label className="grid gap-1 text-sm">
          {c.fields.kind}
          <select name="kind" className={input} defaultValue={editing?.kind ?? "percent"}>
            <option value="percent">{c.kinds.percent}</option>
            <option value="amount">{c.kinds.amount}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.value}
          <input name="value" required inputMode="numeric" defaultValue={editing?.value} className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.tourSlug}
          <select name="tourSlug" className={input} defaultValue={editing?.tourSlug ?? ""}>
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
          <input type="date" name="validFrom" required defaultValue={editing?.validFrom ?? today} className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.validTo}
          <input type="date" name="validTo" required defaultValue={editing?.validTo} className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.minTotalVnd}
          <input name="minTotalVnd" inputMode="numeric" defaultValue={editing?.minTotalVnd || ""} className={input} placeholder="0" />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.maxUses}
          <input name="maxUses" inputMode="numeric" defaultValue={editing?.maxUses ?? ""} className={input} placeholder={c.unlimited} />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-3">
          {c.fields.note}
          <input name="note" maxLength={200} defaultValue={editing?.note} className={input} />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit" data-testid={editing ? "discount-save" : "discount-create"}>
            {editing ? c.save : c.create}
          </Button>
          {editing && (
            <a href={localePath(locale, "/admin/discounts")} className="pb-2 text-sm text-muted-foreground hover:underline">
              {c.cancelEdit}
            </a>
          )}
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
                  {formatShortDay(d.validFrom, locale)} → {formatShortDay(d.validTo, locale)}
                </td>
                <td className="py-2 pr-3">{d.tourSlug ? (tours.find((t) => t.slug === d.tourSlug)?.title ?? d.tourSlug) : c.allTours}</td>
                <td className="py-2 pr-3" data-testid="discount-used">
                  {d.used}
                  {d.maxUses !== null && ` / ${d.maxUses}`}
                </td>
                <td className="py-2 pr-3">{!d.active ? c.status.off : d.validTo < today ? c.status.ended : c.status.on}</td>
                <td className="flex items-center gap-2 py-2 pr-3">
                  <a href={localePath(locale, `/admin/discounts?edit=${d.id}`)} className="text-sm text-primary underline-offset-2 hover:underline" aria-label={`${c.edit} ${d.code}`}>
                    {c.edit}
                  </a>
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
