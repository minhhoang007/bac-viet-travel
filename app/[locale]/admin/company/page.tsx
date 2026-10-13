import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { saveBank, saveCompany } from "@/app/actions/company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/config/app";
import { getCompanyContent } from "@/product/company/content";
import { BANKS, companyFormValues, demoFields, type CompanyInput } from "@/product/company/settings";
import { ConfirmButton } from "@/product/components/confirm-button";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getCompanyContent((await params).locale).title };
}

/** Company details and bank account (owner review 2026-10-13): admins change them without a developer. */
export default async function CompanyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireAdmin();
  const c = getCompanyContent(locale);
  const { company, bank } = await container.app!.product.company.get();
  const values = companyFormValues(company);
  const demo = new Set(demoFields(company));
  const { result } = await searchParams;
  const hint = (id: string, text?: string) => text && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{text}</p>;

  return (
    <div className="grid max-w-3xl gap-8">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{c.intro}</p>
      </div>
      {result && (
        <p role="status" className={`rounded-md border p-3 text-sm ${result === "done" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
          {c.result[result] ?? c.result.failed}
        </p>
      )}
      {demo.size > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm" data-testid="company-demo">
          {c.demo(demo.size)}
        </p>
      )}

      <form action={saveCompany} id="company" className="grid gap-4 rounded-lg border border-border p-4" data-testid="company-form">
        <input type="hidden" name="locale" value={locale} />
        <h2 className="font-semibold">{c.company}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(c.fields) as (keyof CompanyInput)[]).map((key) => {
            const f = c.fields[key];
            const id = `company-${key}`;
            return (
              <div key={key} className={`grid content-start gap-1 ${key === "address" || key.endsWith("Url") ? "sm:col-span-2" : ""}`}>
                <label htmlFor={id} className="text-sm font-medium">{f.label}</label>
                <Input
                  id={id}
                  name={key}
                  defaultValue={values[key]}
                  required={!key.endsWith("Url")}
                  type={key === "email" ? "email" : key.endsWith("Url") ? "url" : "text"}
                  aria-describedby={"hint" in f && f.hint ? `${id}-hint` : undefined}
                  className={demo.has(key) ? "border-warning ring-1 ring-warning" : undefined}
                />
                {hint(id, "hint" in f ? f.hint : undefined)}
              </div>
            );
          })}
        </div>
        <Button type="submit" className="w-fit" data-testid="company-save">{c.saveCompany}</Button>
      </form>

      <form action={saveBank} id="bank" className="grid gap-4 rounded-lg border border-border p-4" data-testid="bank-form">
        <input type="hidden" name="locale" value={locale} />
        <h2 className="font-semibold">{c.bank}</h2>
        <p className="text-sm text-muted-foreground">{c.bankIntro}</p>
        {bank.demo && <p className="text-sm font-medium text-warning">{c.bankDemo}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-1">
            <label htmlFor="bank-bin" className="text-sm font-medium">{c.bankFields.bankBin.label}</label>
            <select id="bank-bin" name="bankBin" defaultValue={bank.bankBin} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
              {Object.entries(BANKS).map(([bin, name]) => (
                <option key={bin} value={bin}>{name}</option>
              ))}
            </select>
          </div>
          <div className="grid content-start gap-1">
            <label htmlFor="bank-account" className="text-sm font-medium">{c.bankFields.accountNumber.label}</label>
            <Input id="bank-account" name="accountNumber" inputMode="numeric" required defaultValue={bank.accountNumber} aria-describedby="bank-account-hint" />
            {hint("bank-account", c.bankFields.accountNumber.hint)}
          </div>
          <div className="grid content-start gap-1 sm:col-span-2">
            <label htmlFor="bank-name" className="text-sm font-medium">{c.bankFields.accountName.label}</label>
            <Input id="bank-name" name="accountName" required defaultValue={bank.accountName} aria-describedby="bank-name-hint" />
            {hint("bank-name", c.bankFields.accountName.hint)}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="live" defaultChecked={!bank.demo} /> {c.bankFields.live.label}
        </label>
        <ConfirmButton question={c.bankAsk} className="w-fit" data-testid="bank-save">{c.saveBank}</ConfirmButton>
      </form>
    </div>
  );
}
