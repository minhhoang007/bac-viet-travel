import { setRequestLocale } from "next-intl/server";
import { requirePageUser } from "@/app/_lib/session";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { PageHeader } from "@/components/app-shell/page-header";

export default async function DashboardPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await requirePageUser(locale);
  const c = getAppContent(locale).dashboard;
  return (
    <PageHeader title={`${c.welcome}, ${user.name || user.email}`} description={c.overviewText} />
  );
}
