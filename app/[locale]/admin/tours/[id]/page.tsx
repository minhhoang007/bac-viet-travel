import { readdirSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireTourEditor } from "@/app/_lib/staff";
import { ContentResult, WorkflowPanel } from "@/app/_components/workflow-panel";
import { PageHeader } from "@/components/app-shell/page-header";
import { Notice } from "@/components/feedback/notice";
import { hasRole } from "@/core/auth";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { TourForm } from "@/product/components/tour-form";
import { getImagePickerText } from "@/product/media/content";
import { confirmMediaUpload, requestMediaUpload } from "@/app/actions/media";
import { MediaUploader } from "@/components/media/media-uploader";
import { getAppContent } from "@/content";
import { getTourAdminContent } from "@/product/tours/admin-content";
import { tourDraftSchema } from "@/product/tours/document";
import { TOUR_CONTENT_TYPE } from "@/product/tours/source";

type Props = { params: Promise<{ locale: Locale; id: string }>; searchParams: Promise<{ result?: string; tab?: string }> };

const TABS = ["general", "vi", "en", "seo", "images", "private"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getTourAdminContent(locale).edit };
}

/** Photos shipped with the site (public/tours) until the media library (Cloudinary) is on. */
function staticImages(): string[] {
  try {
    return readdirSync(path.join(process.cwd(), "public", "tours"))
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .map((f) => `/tours/${f}`);
  } catch {
    return [];
  }
}

export default async function EditTourPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { user, container } = await requireTourEditor();
  const content = container.content;
  if (!content) notFound();
  const item = await content.get(id);
  if (!item || item.type !== TOUR_CONTENT_TYPE) notFound();
  const c = getTourAdminContent(locale);
  const { result, tab } = await searchParams;
  const draft = tourDraftSchema.parse(item.draft);
  const title = (draft.vi as { title?: string }).title || item.slug;
  const tourMessage = result && result in c.result ? c.result[result as keyof typeof c.result] : null;
  // Media library on (Cloudinary keys set): pick from it and upload right here, in the Images tab.
  const media = container.media;
  const mediaText = getAppContent(locale).admin.media;
  const library = media
    ? (await media.list({ pageSize: 200 })).rows.map((a) => ({ id: a.id, thumb: media.imageProps(a, { aspect: 4 / 3, widths: [240] }).src, name: a.name || a.id }))
    : undefined;
  const uploader = media ? (
    <MediaUploader
      label={mediaText.upload}
      uploadingLabel={mediaText.uploading}
      formats={media.config.allowedFormats}
      maxBytes={media.config.maxBytes}
      errors={mediaText.errors}
      requestUpload={requestMediaUpload}
      confirmUpload={confirmMediaUpload}
    />
  ) : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="grid content-start gap-5">
        <a href={localePath(locale, "/admin/tours")} className="text-sm text-muted-foreground hover:underline">
          {c.back}
        </a>
        <PageHeader title={title} description={`/tours/${item.publishedSlug ?? item.slug}`} />
        {tourMessage ? <Notice tone={result === "slug_taken" || result === "invalid" ? "danger" : "success"}>{tourMessage}</Notice> : <ContentResult result={result} locale={locale} />}
        <TourForm
          key={item.revision}
          locale={locale}
          item={{ id: item.id, revision: item.revision, slug: item.slug, draft, slugLocked: item.publishedSlug !== null }}
          images={staticImages()}
          library={library}
          uploader={uploader}
          unsplash={process.env.UNSPLASH_ACCESS_KEY ? getImagePickerText(locale) : undefined}
          initialTab={TABS.find((t) => t === tab) ?? "general"}
          canPublish={hasRole(user, "admin")}
        />
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <WorkflowPanel item={item} versions={await content.versions(item.id)} locale={locale} isAdmin={hasRole(user, "admin")} returnTo={`/admin/tours/${item.id}`} />
      </aside>
    </div>
  );
}
