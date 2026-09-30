import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAppServices } from "@/app/_lib/session";
import { sendMagicLink, signInWithGoogle } from "@/app/actions/auth";
import { LoginForm } from "@/components/auth/login-form";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { authConfig } from "@/config/auth";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ error?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getAppContent(locale).login.title, robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);
  const app = await requireAppServices();
  if (await app.auth.getUser(await headers())) redirect(localePath(locale, authConfig.afterSignInPath));

  const c = getAppContent(locale).login;
  return (
    <Container className="max-w-md py-16">
      <h1 className="text-2xl font-bold">{c.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{c.subtitle}</p>
      {error && (
        <p role="alert" className="mt-4 rounded-md border border-red-600/40 p-3 text-sm text-red-600">
          {c.errors.link}
        </p>
      )}
      <div className="mt-8 grid gap-6">
        {app.auth.methods.magicLink && <LoginForm locale={locale} sendMagicLink={sendMagicLink} labels={c} />}
        {app.auth.methods.magicLink && app.auth.methods.google && (
          <p className="text-center text-xs text-muted-foreground uppercase">{c.or}</p>
        )}
        {app.auth.methods.google && (
          <form action={signInWithGoogle}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="h-11 w-full rounded-md border border-border text-sm font-medium hover:bg-muted">
              {c.google}
            </button>
          </form>
        )}
      </div>
    </Container>
  );
}
