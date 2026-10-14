import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/app/_lib/admin";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/app-shell/page-header";

type Props = { params: Promise<{ locale: Locale }> };

/** DEMO_MODE: the emails the site would have sent (bookings, reminders, contact), for visitors trying the admin. */
export default async function DemoMailPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireStaff("editor");
  if (!container.demoMailbox) notFound();
  const c = getAppContent(locale).demo.mailbox;
  const emails = await container.demoMailbox.list(50);
  const time = (t: Date) => t.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB");

  return (
    <div className="grid gap-6">
      <PageHeader title={c.title} description={c.intro} />
      {emails.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <ul className="grid gap-2" data-testid="demo-mailbox">
          {emails.map((e) => (
            <li key={e.id}>
              <details className="rounded-md border border-border p-3 text-sm">
                <summary className="grid cursor-pointer gap-0.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                  <span className="min-w-0 break-words font-medium">{e.subject}</span>
                  <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{time(e.createdAt)}</span>
                  <span className="min-w-0 break-all text-xs text-muted-foreground">
                    {c.to}: {e.to}
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-line break-words border-t border-border pt-3">{e.text}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
