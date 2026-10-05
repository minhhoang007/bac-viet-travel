import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { deleteMedia, updateMedia } from "@/app/actions/media";
import { requireStaff } from "@/app/_lib/admin";
import { ResultNotice } from "@/components/admin/result-notice";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FocalPicker } from "@/components/media/focal-picker";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/components/ui/format-bytes";
import { localePath } from "@/core/i18n/routing";
import { appConfig, type Locale } from "@/config/app";
import { getAppContent } from "@/content";

type Props = { params: Promise<{ locale: Locale; id: string }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).admin.media.edit };
}

export default async function MediaEditPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const { container } = await requireStaff("editor");
  const media = container.media;
  if (!media) notFound();
  const asset = await media.get(id);
  if (!asset) notFound();
  const content = getAppContent(locale).admin;
  const c = content.media;
  const { result } = await searchParams;
  const preview = media.imageProps(asset, { widths: [1280] });

  return (
    <div className="grid max-w-3xl gap-6">
      <a href={localePath(locale, "/admin/media")} className="text-sm text-muted-foreground hover:underline">
        {c.back}
      </a>
      <PageHeader title={asset.name || c.edit} description={`${c.size}: ${asset.width} × ${asset.height} · ${formatBytes(asset.bytes)} · ${asset.format.toUpperCase()}`} />
      {result === "in_use" ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{c.errors.inUse}</p>
      ) : (
        <ResultNotice result={result} done={content.done} failed={content.failed} />
      )}
      <form action={updateMedia} className="grid gap-5">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={asset.id} />
        <fieldset className="grid gap-2">
          <legend className="font-semibold">{c.focal}</legend>
          <p className="text-sm text-muted-foreground">{c.focalHint}</p>
          <FocalPicker src={preview.src} alt={asset.alt[locale] ?? ""} initial={{ x: asset.focalX, y: asset.focalY }} label={c.focal} />
        </fieldset>
        <fieldset className="grid gap-3">
          <legend className="font-semibold">{c.alt}</legend>
          <p className="text-sm text-muted-foreground">{c.altHint}</p>
          {appConfig.locales.map((l) => (
            <label key={l} className="grid gap-1 text-sm">
              {l.toUpperCase()}
              <input name={`alt_${l}`} defaultValue={asset.alt[l] ?? ""} maxLength={300} className="h-10 rounded-md border border-border bg-background px-3" />
            </label>
          ))}
        </fieldset>
        <Button type="submit" className="w-fit">{c.save}</Button>
      </form>
      <ConfirmDialog trigger={c.remove} title={content.confirmTitle} description={c.removeAsk} cancel={content.cancel} action={deleteMedia} destructive>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={asset.id} />
      </ConfirmDialog>
    </div>
  );
}
