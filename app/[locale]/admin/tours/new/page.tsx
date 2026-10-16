import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireTourEditor } from "@/app/_lib/staff";
import { createTour } from "@/app/actions/tours";
import { PageHeader } from "@/components/app-shell/page-header";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { getTourAdminContent } from "@/product/tours/admin-content";
import { SlugFromTitle } from "@/product/components/slug-from-title";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getTourAdminContent(locale).create.title };
}

export default async function NewTourPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireTourEditor();
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
        <SlugFromTitle titleLabel={c.create.titleVi} titleName="titleVi" titleMaxLength={120} slugLabel={c.create.slug} slugHint={c.create.slugHint} className={input} />
        <SubmitButton label={c.create.submit} pendingLabel={c.saving} />
      </form>
    </div>
  );
}
