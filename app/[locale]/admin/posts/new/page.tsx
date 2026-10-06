import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { createPost } from "@/app/actions/posts";
import { PageHeader } from "@/components/app-shell/page-header";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { localePath } from "@/core/i18n/routing";
import { appConfig, type Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { inputClass, requirePostsAdmin } from "../_shared";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).admin.posts.newPost };
}

export default async function NewPostPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePostsAdmin();
  const admin = getAppContent(locale).admin;
  const c = admin.posts;
  const { result } = await searchParams;
  const message = result === "slug_taken" ? c.result.slug_taken : result === "invalid" ? c.result.invalid : result ? admin.failed : null;

  return (
    <div className="grid max-w-xl gap-6">
      <a href={localePath(locale, "/admin/posts")} className="text-sm text-muted-foreground hover:underline">
        {c.back}
      </a>
      <PageHeader title={c.newPost} />
      {message && <Notice tone="danger">{message}</Notice>}
      <form action={createPost} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="grid gap-1 text-sm">
          {c.fields.locale}
          <select name="postLocale" defaultValue={locale} className={inputClass}>
            {appConfig.locales.map((l) => (
              <option key={l} value={l}>
                {c.locales[l] ?? l}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.title}
          <input name="title" required maxLength={200} className={inputClass} />
        </label>
        <label className="grid gap-1 text-sm">
          {c.fields.slug}
          <input name="slug" required maxLength={110} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="slug-hint" className={inputClass} />
          <span id="slug-hint" className="text-xs text-muted-foreground">
            {c.fields.slugHint}
          </span>
        </label>
        <SubmitButton label={c.create} pendingLabel={c.saving} />
      </form>
    </div>
  );
}
