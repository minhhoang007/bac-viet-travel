import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { confirmMediaUpload, requestMediaUpload } from "@/app/actions/media";
import { requireStaff } from "@/app/_lib/admin";
import { ResultNotice } from "@/components/admin/result-notice";
import { PageHeader } from "@/components/app-shell/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { MediaImage } from "@/components/media/media-image";
import { MediaUploader } from "@/components/media/media-uploader";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ q?: string; page?: string; result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).admin.media.title };
}

/** Media library (ADR-0008): editors and admins upload and manage public images. */
export default async function MediaLibraryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireStaff("editor");
  const media = container.media;
  if (!media) notFound();
  const content = getAppContent(locale).admin;
  const c = content.media;
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { rows, total } = await media.list({ query: sp.q, page, pageSize: 48 });

  return (
    <div className="grid gap-6">
      <PageHeader title={c.title} />
      <ResultNotice result={sp.result} done={content.done} failed={content.failed} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <MediaUploader
          label={c.upload}
          uploadingLabel={c.uploading}
          formats={media.config.allowedFormats}
          maxBytes={media.config.maxBytes}
          errors={c.errors}
          requestUpload={requestMediaUpload}
          confirmUpload={confirmMediaUpload}
        />
        <form method="get">
          <input name="q" defaultValue={sp.q} placeholder={c.search} aria-label={c.search} className="h-10 w-64 rounded-md border border-border bg-background px-3 text-sm" />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="media-grid">
          {rows.map((a) => (
            <li key={a.id}>
              <a href={localePath(locale, `/admin/media/${a.id}`)} className="group block overflow-hidden rounded-lg border border-border">
                <MediaImage image={media.imageProps(a, { aspect: 4 / 3, widths: [320, 640] })} alt={a.alt[locale] ?? ""} sizes="(min-width: 1024px) 25vw, 50vw" className="aspect-[4/3] w-full object-cover" />
                <span className="block truncate px-2 py-1 text-xs text-muted-foreground group-hover:text-foreground">{a.name || a.id}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <nav className="flex gap-3 text-sm">
        {page > 1 && <a href={localePath(locale, `/admin/media?page=${page - 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`)}>← {content.users.previous}</a>}
        {page * 48 < total && <a href={localePath(locale, `/admin/media?page=${page + 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`)}>{content.users.next} →</a>}
      </nav>
    </div>
  );
}
