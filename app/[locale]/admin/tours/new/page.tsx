import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/app/_lib/admin";
import { createTour } from "@/app/actions/tours";
import { PageHeader } from "@/components/app-shell/page-header";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { getTourAdminContent } from "@/product/tours/admin-content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getTourAdminContent(locale).create.title };
}

export default async function NewTourPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireStaff("editor");
  if (!container.content) notFound();
  const c = getTourAdminContent(locale);
  const { result } = await searchParams;
  const message = result === "slug_taken" ? c.result.slug_taken : result === "invalid" ? c.result.invalid : result ? getAppContent(locale).admin.failed : null;
  const input = "h-10 rounded-md border border-border bg-background px-3";

  return (
    <div className="grid max-w-xl gap-6">
      <a href={localePath(locale, "/admin/tours")} className="text-sm text-muted-foreground hover:underline">
        {c.back}
      </a>
      <PageHeader title={c.create.title} />
      {message && <Notice tone="danger">{message}</Notice>}
      <form action={createTour} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="grid gap-1 text-sm">
          {c.create.titleVi}
          <input name="titleVi" required maxLength={120} className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          {c.create.slug}
          <input name="slug" required maxLength={110} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="slug-hint" className={input} />
          <span id="slug-hint" className="text-xs text-muted-foreground">
            {c.create.slugHint}
          </span>
        </label>
        <SubmitButton label={c.create.submit} pendingLabel={c.saving} />
      </form>
    </div>
  );
}
