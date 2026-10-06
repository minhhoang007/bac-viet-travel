import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ContentResult, WorkflowPanel } from "@/app/_components/workflow-panel";
import { savePost } from "@/app/actions/posts";
import { POST_CONTENT_TYPE } from "@/bootstrap/content-types";
import { PageHeader } from "@/components/app-shell/page-header";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { hasRole } from "@/core/auth";
import { localePath } from "@/core/i18n/routing";
import { appConfig, type Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { contentPostProblems } from "@/modules/blog";
import { inputClass, requirePostsAdmin } from "../_shared";

type Props = { params: Promise<{ locale: Locale; id: string }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).admin.posts.edit };
}

function Field({ label, hint, id, children }: { label: string; hint?: string; id: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <span id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  );
}

/** One post: a plain server form (no client code), the problems that block submitting, and the workflow panel. */
export default async function EditPostPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { user, content } = await requirePostsAdmin();
  const item = await content.get(id);
  if (!item || item.type !== POST_CONTENT_TYPE) notFound();
  const admin = getAppContent(locale).admin;
  const c = admin.posts;
  const { result } = await searchParams;
  const d = item.draft;
  const str = (key: string) => (typeof d[key] === "string" ? (d[key] as string) : "");
  const tags = Array.isArray(d.tags) ? (d.tags as unknown[]).filter((t) => typeof t === "string").join(", ") : "";
  const problems = contentPostProblems(d);
  const labels: Record<string, string> = { ...c.fields };
  const postMessage = result && result in c.result ? c.result[result as keyof typeof c.result] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid content-start gap-5">
        <a href={localePath(locale, "/admin/posts")} className="text-sm text-muted-foreground hover:underline">
          {c.back}
        </a>
        <PageHeader title={str("title") || item.slug} description={`/blog/${item.publishedSlug ?? item.slug}`} />
        {postMessage ? <Notice tone={result === "saved" ? "success" : "danger"}>{postMessage}</Notice> : <ContentResult result={result} locale={locale} />}
        {problems.length > 0 && (
          <Notice tone="warning" role="note" title={c.problemsTitle} data-testid="post-problems">
            <ul className="list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{labels[p.split(".")[0]!] ?? p}</li>
              ))}
            </ul>
          </Notice>
        )}
        <form action={savePost} className="grid gap-4" key={item.revision}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="revision" value={item.revision} />
          <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <Field label={c.fields.locale} id="post-locale">
              <select id="post-locale" name="postLocale" defaultValue={str("locale") || appConfig.defaultLocale} className={inputClass}>
                {appConfig.locales.map((l) => (
                  <option key={l} value={l}>
                    {c.locales[l] ?? l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={c.fields.title} id="post-title">
              <input id="post-title" name="title" maxLength={200} defaultValue={str("title")} className={inputClass} />
            </Field>
          </div>
          <Field label={c.fields.slug} hint={c.fields.slugHint} id="post-slug">
            <input id="post-slug" name="slug" required maxLength={110} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="post-slug-hint" defaultValue={item.slug} className={inputClass} />
          </Field>
          <Field label={c.fields.description} id="post-description">
            <textarea id="post-description" name="description" rows={2} maxLength={300} defaultValue={str("description")} className="w-full rounded-md border border-border bg-background p-3 text-sm" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={c.fields.date} id="post-date">
              <input id="post-date" name="date" type="date" defaultValue={str("date")} className={inputClass} />
            </Field>
            <Field label={c.fields.updated} id="post-updated">
              <input id="post-updated" name="updated" type="date" defaultValue={str("updated")} className={inputClass} />
            </Field>
          </div>
          <Field label={c.fields.tags} hint={c.fields.tagsHint} id="post-tags">
            <input id="post-tags" name="tags" aria-describedby="post-tags-hint" defaultValue={tags} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={c.fields.cover} hint={c.fields.coverHint} id="post-cover">
              <input id="post-cover" name="cover" aria-describedby="post-cover-hint" maxLength={500} defaultValue={str("cover")} className={inputClass} />
            </Field>
            <Field label={c.fields.author} id="post-author">
              <input id="post-author" name="author" maxLength={100} defaultValue={str("author")} className={inputClass} />
            </Field>
          </div>
          <Field label={c.fields.translationKey} hint={c.fields.translationKeyHint} id="post-translation">
            <input id="post-translation" name="translationKey" aria-describedby="post-translation-hint" maxLength={100} defaultValue={str("translationKey")} className={inputClass} />
          </Field>
          <Field label={c.fields.body} hint={c.fields.bodyHint} id="post-body">
            <textarea id="post-body" name="body" rows={20} aria-describedby="post-body-hint" defaultValue={str("body")} className="w-full rounded-md border border-border bg-background p-3 font-mono text-sm" />
          </Field>
          <div className="sticky bottom-0 -mx-1 bg-background/95 px-1 py-3 backdrop-blur">
            <SubmitButton label={c.save} pendingLabel={c.saving} />
          </div>
        </form>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <WorkflowPanel item={item} versions={await content.versions(item.id)} locale={locale} isAdmin={hasRole(user, "admin")} returnTo={`/admin/posts/${item.id}`} />
      </aside>
    </div>
  );
}
