import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAppServices } from "@/app/_lib/session";
import { requestPasswordReset, resetPassword } from "@/app/actions/auth";
import { getPublicEnv } from "@/bootstrap/env";
import { NewPasswordForm, PasswordResetRequestForm } from "@/components/auth/password-forms";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/app";
import { authConfig } from "@/config/auth";
import { getSecurityContent } from "@/content/security";
import { localePath } from "@/core/i18n/routing";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ token?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getSecurityContent((await params).locale).reset.title, robots: { index: false } };
}

/**
 * Staff password: without `token`, asks for the emailed link ("forgot password"); with it (from an invitation or a
 * reset email), sets the new password. Opening the page uses nothing up: the token is spent only when saving.
 */
export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const app = await requireAppServices();
  if (!app.auth.methods.password) notFound();
  const { token } = await searchParams;
  const c = getSecurityContent(locale).reset;

  return (
    <Container className="grid max-w-md gap-6 py-16">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{token ? c.newText : c.requestText}</p>
      </div>
      {token ? (
        <NewPasswordForm locale={locale} token={token} action={resetPassword} labels={{ password: c.password, confirm: c.confirm, save: c.save, saving: c.saving, errors: c.errors }} />
      ) : (
        <PasswordResetRequestForm
          locale={locale}
          action={requestPasswordReset}
          turnstileSiteKey={getPublicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          labels={{ email: c.email, send: c.send, sending: c.sending, sent: c.sent, invalidEmail: c.invalidEmail, errors: c.errors }}
        />
      )}
      <a href={localePath(locale, authConfig.signInPath)} className="text-sm text-muted-foreground underline underline-offset-4">
        {c.back}
      </a>
    </Container>
  );
}
