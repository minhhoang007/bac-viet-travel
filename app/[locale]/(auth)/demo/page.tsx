import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { signInAsDemo } from "@/app/actions/auth";
import { demoAccounts } from "@/bootstrap/container";
import { getPublicEnv } from "@/bootstrap/env";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { Container } from "@/components/ui/container";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).demo.tryAdmin.title, robots: { index: false } };
}

/** Demo site only: pick a demo staff account and sign in with one click (no email, no second factor). */
export default async function DemoSignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const accounts = demoAccounts();
  if (!getPublicEnv().demoMode || accounts.length === 0) notFound();
  const c = getAppContent(locale).demo.tryAdmin;
  const { result } = await searchParams;

  return (
    <Container className="grid max-w-3xl gap-6 py-12">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </div>
      {result && <Notice tone="danger">{result === "rate_limited" ? c.rateLimited : c.failed}</Notice>}
      <ul className="grid gap-4 sm:grid-cols-2" data-testid="demo-accounts">
        {accounts.map((a) => (
          <li key={a.email} className="grid content-between gap-4 rounded-lg border border-border p-5">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold">{a.label[locale]}</h2>
              <p className="text-sm text-muted-foreground">{a.description[locale]}</p>
            </div>
            <form action={signInAsDemo}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="email" value={a.email} />
              <SubmitButton label={c.signIn} size="default" />
            </form>
          </li>
        ))}
      </ul>
    </Container>
  );
}
