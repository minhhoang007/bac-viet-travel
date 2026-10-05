import { setRequestLocale } from "next-intl/server";
import { requirePageUser } from "@/app/_lib/session";
import { deleteAccount } from "@/app/actions/account";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/app-shell/page-header";

export default async function AccountPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await requirePageUser(locale);
  const c = getAppContent(locale).account;

  return (
    <div className="grid max-w-xl gap-8">
      <PageHeader title={c.title} />
      <section>
        <h2 className="font-semibold">{c.profile}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </section>
      <section>
        <h2 className="font-semibold">{c.exportTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{c.exportText}</p>
        {/* File download from a route handler, so a plain GET form rather than client navigation */}
        <form action="/api/account/export" method="get" className="mt-3">
          <button type="submit" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
            {c.exportButton}
          </button>
        </form>
      </section>
      <section className="rounded-md border border-danger/40 p-4">
        <h2 className="font-semibold text-danger">{c.deleteTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{c.deleteText}</p>
        <form action={deleteAccount} className="mt-3 grid gap-2">
          <input type="hidden" name="locale" value={locale} />
          <label htmlFor="confirm-email" className="text-sm">
            {c.deleteConfirmLabel}
            <input
              id="confirm-email"
              name="confirmEmail"
              type="email"
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <SubmitButton label={c.deleteButton} variant="destructive" />
        </form>
      </section>
    </div>
  );
}
