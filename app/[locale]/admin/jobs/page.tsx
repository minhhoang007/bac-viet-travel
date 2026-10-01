import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { retryJob } from "@/app/actions/admin";
import { ResultNotice } from "@/components/admin/result-notice";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

export default async function AdminJobsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { result } = await searchParams;
  setRequestLocale(locale);
  const { container } = await requireAdmin();
  if (!container.jobs) notFound();
  const c = getAppContent(locale).admin;
  const jobs = await container.jobs.list({ statuses: ["failed", "dead"], limit: 100 });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">{c.jobs.title}</h1>
      <ResultNotice result={result} done={c.done} failed={c.failed} />
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.jobs.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">{c.jobs.name}</th>
                <th className="py-2 pr-4 font-medium">{c.users.status}</th>
                <th className="py-2 pr-4 font-medium">{c.jobs.attempts}</th>
                <th className="py-2 pr-4 font-medium">{c.jobs.lastError}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-border align-top" data-job-status={job.status}>
                  <td className="py-2 pr-4 font-mono text-xs">{job.name}</td>
                  <td className="py-2 pr-4">{job.status}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="max-w-xs truncate py-2 pr-4 text-muted-foreground" title={job.lastError ?? ""}>
                    {job.lastError}
                  </td>
                  <td className="py-2">
                    <form action={retryJob}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={job.id} />
                      <button type="submit" className="rounded border border-border px-3 py-1 hover:bg-muted">
                        {c.jobs.retry}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
