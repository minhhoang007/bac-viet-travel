import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
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
  const { demoMode, demoContactUrl: contactUrl } = getPublicEnv();
  if (!demoMode || accounts.length === 0) notFound();
  const c = getAppContent(locale).demo.tryAdmin;
  const { result } = await searchParams;

  return (
    <Container className="grid max-w-3xl gap-6 py-12">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </div>
      {c.steps && c.steps.length > 0 && (
        <section className="grid gap-3 rounded-lg border border-border bg-muted p-5" aria-labelledby="demo-steps" data-testid="demo-steps">
          <h2 id="demo-steps" className="font-semibold">
            {c.stepsTitle}
          </h2>
          <ol className="grid list-decimal gap-2 pl-5 text-sm">
            {c.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      )}
      {result && <Notice tone="danger">{result === "rate_limited" ? c.rateLimited : c.failed}</Notice>}
      <ul className="grid gap-4 sm:grid-cols-2" data-testid="demo-accounts">
        {accounts.map((a) => (
          <li key={a.email} className="grid content-between gap-4 rounded-lg border border-border p-5">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold">{a.label[locale]}</h2>
              <p className="text-sm text-muted-foreground">{a.description[locale]}</p>
            </div>
            {/* A plain POST to a route handler: its redirect must load in full (see app/api/demo/sign-in). */}
            <form method="post" action="/api/demo/sign-in">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="email" value={a.email} />
              <SubmitButton label={c.signIn} size="default" />
            </form>
          </li>
        ))}
      </ul>
      {contactUrl && (
        <p className="text-center">
          <a href={contactUrl} className="font-medium underline underline-offset-4 hover:no-underline">
            {getAppContent(locale).demo.contact}
          </a>
        </p>
      )}
    </Container>
  );
}
