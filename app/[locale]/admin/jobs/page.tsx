import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { retryJob } from "@/app/actions/admin";
import { ResultNotice } from "@/components/admin/result-notice";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { SubmitButton } from "@/components/forms/submit-button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";

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
      <PageHeader title={c.jobs.title} />
      <ResultNotice result={result} done={c.done} failed={c.failed} />
      {jobs.length === 0 ? (
        <EmptyState title={c.jobs.empty} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{c.jobs.name}</TableHead>
              <TableHead>{c.users.status}</TableHead>
              <TableHead>{c.jobs.attempts}</TableHead>
              <TableHead>{c.jobs.lastError}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id} className="align-top" data-job-status={job.status}>
                <TableCell className="font-mono text-xs">{job.name}</TableCell>
                <TableCell>{job.status}</TableCell>
                <TableCell className="tabular-nums">
                  {job.attempts}/{job.maxAttempts}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground" title={job.lastError ?? ""}>
                  {job.lastError}
                </TableCell>
                <TableCell>
                  <form action={retryJob}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={job.id} />
                    <SubmitButton label={c.jobs.retry} variant="outline" size="sm" />
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
