import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAppServices } from "@/app/_lib/session";
import { sendMagicLink, signInWithGoogle } from "@/app/actions/auth";
import { signInWithCode } from "@/app/actions/security";
import { getPublicEnv } from "@/bootstrap/env";
import { LoginForm } from "@/components/auth/login-form";
import { PasskeySignInButton } from "@/components/auth/passkey-buttons";
import { getSecurityContent } from "@/content/security";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import { authConfig } from "@/config/auth";
import type { Locale } from "@/config/app";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
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
  const s = getSecurityContent(locale).signIn;
  const labels = {
    ...c,
    errors: { ...c.errors, captcha: s.captcha },
    code: { title: s.codeTitle, hint: s.codeHint, label: s.code, submit: s.useCode, wrong: s.codeWrong },
  };
  return (
    <Container className="max-w-md py-16">
      <h1 className="text-2xl font-bold">{c.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{c.subtitle}</p>
      {error && (
        <Notice tone="danger" className="mt-4">
          {c.errors.link}
        </Notice>
      )}
      <div className="mt-8 grid gap-6">
        {/* Passkey first: one touch for staff who set one up (and it counts as the second factor). */}
        <div className="grid gap-1">
          <PasskeySignInButton label={s.passkey} failed={s.passkeyFailed} next={localePath(locale, authConfig.afterSignInPath)} />
          <p className="text-center text-xs text-muted-foreground">{s.passkeyHint}</p>
        </div>
        {app.auth.methods.magicLink && <p className="text-center text-xs text-muted-foreground uppercase">{c.or}</p>}
        {app.auth.methods.magicLink && (
          <LoginForm locale={locale} sendMagicLink={sendMagicLink} signInWithCode={signInWithCode} turnstileSiteKey={getPublicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY} labels={labels} />
        )}
        {app.auth.methods.magicLink && app.auth.methods.google && (
          <p className="text-center text-xs text-muted-foreground uppercase">{c.or}</p>
        )}
        {app.auth.methods.google && (
          <form action={signInWithGoogle}>
            <input type="hidden" name="locale" value={locale} />
            <SubmitButton label={c.google} variant="outline" className="h-11 w-full justify-self-stretch" />
          </form>
        )}
      </div>
    </Container>
  );
}
