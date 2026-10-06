import { approveContent, rejectContent, restoreContent, setContentHidden, submitContent } from "@/app/actions/content";
import { ResultNotice } from "@/components/admin/result-notice";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { appConfig, type Locale } from "@/config/app";
import { getAppContent } from "@/content";
import type { ContentItem, ContentVersion } from "@/modules/content";

export function formatContentDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: appConfig.timeZone }).format(date);
}

/**
 * Status, review actions and version history for one content item. Projects put it on their edit page
 * (`returnTo` = that page's locale-less path); the page shows `?result=` with <ContentResult>.
 */
export function WorkflowPanel({ item, versions, locale, isAdmin, returnTo }: { item: ContentItem; versions: ContentVersion[]; locale: Locale; isAdmin: boolean; returnTo: string }) {
  const content = getAppContent(locale).admin;
  const c = content.content;
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="revision" value={item.revision} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );
  const live = item.published !== null && !item.hidden;

  return (
    <section aria-labelledby="workflow-title" className="grid gap-4 rounded-lg border border-border p-4">
      <h2 id="workflow-title" className="font-semibold">
        {c.workflow}
      </h2>
      <dl className="grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">{c.status}:</dt>
          <dd data-status={item.status}>{c.statuses[item.status]}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">{c.live}</dt>
          <dd>{item.hidden ? c.hidden : live ? c.live : c.notLive}</dd>
        </div>
        {item.status === "approved" && item.publishAt && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{c.scheduledFor}:</dt>
            <dd>{formatContentDate(item.publishAt, locale)}</dd>
          </div>
        )}
      </dl>
      {item.reviewNote && item.status === "draft" && (
        <Notice tone="warning" role="note" title={c.reviewNote}>
          {item.reviewNote}
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        <a href={`/api/content/preview?id=${item.id}&locale=${locale}`} target="_blank" rel="noopener" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted">
          {c.preview}
        </a>
        {item.status === "draft" && !isAdmin && (
          <form action={submitContent}>
            {hidden}
            <SubmitButton label={c.submit} size="default" />
          </form>
        )}
        {isAdmin && (item.status === "draft" || item.status === "pending") && (
          <form action={approveContent}>
            {hidden}
            <SubmitButton label={c.publishNow} size="default" />
          </form>
        )}
        {isAdmin && item.published !== null && (
          <form action={setContentHidden}>
            {hidden}
            <input type="hidden" name="hidden" value={String(!item.hidden)} />
            <SubmitButton label={item.hidden ? c.show : c.hide} variant="outline" size="default" />
          </form>
        )}
      </div>

      {isAdmin && (item.status === "draft" || item.status === "pending") && (
        <form action={approveContent} className="flex flex-wrap items-end gap-2">
          {hidden}
          <label className="grid gap-1 text-sm">
            {c.scheduleAt}
            <input type="datetime-local" name="publishAt" required className="h-9 rounded-md border border-border bg-background px-2" />
          </label>
          <SubmitButton label={c.schedule} variant="outline" size="default" />
        </form>
      )}

      {isAdmin && (item.status === "pending" || item.status === "approved") && (
        <form action={rejectContent} className="grid gap-2">
          {hidden}
          <label className="grid gap-1 text-sm">
            {c.rejectNote}
            <textarea name="note" rows={3} maxLength={2000} className="rounded-md border border-border bg-background p-2" />
          </label>
          <SubmitButton label={c.reject} variant="outline" size="default" />
        </form>
      )}

      {versions.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{c.history}</summary>
          <ul className="mt-2 grid gap-2 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <span>{formatContentDate(v.createdAt, locale)}</span>
                <span className="text-muted-foreground">
                  {c.events[v.event]} · {v.slug}
                </span>
                <ConfirmDialog trigger={c.restore} title={content.confirmTitle} description={c.restoreAsk} cancel={content.cancel} action={restoreContent}>
                  {hidden}
                  <input type="hidden" name="versionId" value={v.id} />
                </ConfirmDialog>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Outcome of the last workflow action (?result=done|conflict|failed). */
export function ContentResult({ result, locale }: { result?: string; locale: Locale }) {
  const content = getAppContent(locale).admin;
  if (result === "conflict") return <Notice tone="danger">{content.content.conflict}</Notice>;
  if (result === "incomplete") return <Notice tone="danger">{content.content.incomplete}</Notice>;
  return <ResultNotice result={result} done={content.done} failed={content.failed} />;
}
