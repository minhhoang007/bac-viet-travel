import { setRequestLocale } from "next-intl/server";
import { requirePageUser } from "@/app/_lib/session";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";

export default async function DashboardPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await requirePageUser(locale);
  const c = getAppContent(locale).dashboard;
  return (
    <>
      <h1 className="text-2xl font-bold">
        {c.welcome}, {user.name || user.email}
      </h1>
      <p className="mt-2 text-muted-foreground">{c.overviewText}</p>
    </>
  );
}
