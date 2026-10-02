import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getContainer } from "@/bootstrap/container";
import { requirePageUser } from "@/app/_lib/session";
import { confirmUpload, deleteFile, requestUpload } from "@/app/actions/storage";
import { Uploader } from "@/components/storage/uploader";
import { formatBytes } from "@/components/ui/format-bytes";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { PageHeader } from "@/components/app-shell/page-header";

export default async function FilesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await requirePageUser(locale);
  const { storage } = getContainer();
  if (!storage) notFound();
  const c = getAppContent(locale).files;
  const [list, usage] = await Promise.all([storage.list(user.id), storage.usage(user.id)]);

  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title={c.title} />
      <p className="text-sm text-muted-foreground" data-testid="storage-usage">
        {c.usage}: {formatBytes(usage.usedBytes)} / {formatBytes(usage.quotaBytes)}
      </p>
      <div className="grid gap-1">
        <Uploader
          label={c.upload}
          uploadingLabel={c.uploading}
          accept={storage.config.allowedTypes}
          maxBytes={storage.config.maxFileBytes}
          errors={c.errors}
          requestUpload={requestUpload}
          confirmUpload={confirmUpload}
        />
        <p className="text-xs text-muted-foreground">
          {c.allowed} {formatBytes(storage.config.maxFileBytes)}
        </p>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="grid gap-2" data-testid="file-list">
          {list.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
              <span className="min-w-0 flex-1 truncate" title={f.name}>
                {f.name}
              </span>
              <span className="text-muted-foreground tabular-nums">{formatBytes(f.size)}</span>
              <a href={`/api/storage/files/${f.id}`} className="rounded border border-border px-3 py-1 hover:bg-muted">
                {c.download}
              </a>
              <form action={deleteFile}>
                <input type="hidden" name="id" value={f.id} />
                <button type="submit" className="rounded border border-border px-3 py-1 hover:bg-muted">
                  {c.delete}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
