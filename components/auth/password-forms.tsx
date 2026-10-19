"use client";

import Script from "next/script";
import { useActionState, useState } from "react";
import type { NewPasswordState, PasswordResetRequestState, PasswordSignInState } from "@/app/actions/auth";
import { FormError } from "@/components/forms/form-error";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";

function Turnstile({ siteKey, locale }: { siteKey?: string; locale: string }) {
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      {/* Turnstile adds a hidden "cf-turnstile-response" field to the form. */}
      <div className="cf-turnstile" data-sitekey={siteKey} data-language={locale} />
    </>
  );
}

/** Staff sign-in with email and password. The email stays typed after a wrong password (React resets the form). */
export function PasswordSignInForm({
  locale,
  action,
  turnstileSiteKey,
  forgotHref,
  labels,
}: {
  locale: string;
  action: (prev: PasswordSignInState, formData: FormData) => Promise<PasswordSignInState>;
  turnstileSiteKey?: string;
  forgotHref: string;
  labels: { title: string; email: string; password: string; submit: string; pending: string; forgot: string; errors: { wrong: string; rate_limited: string; captcha: string; error: string } };
}) {
  const [state, submit] = useActionState(action, null);
  const [email, setEmail] = useState("");
  return (
    <form action={submit} className="grid gap-4" data-testid="password-sign-in" noValidate>
      <p className="font-medium">{labels.title}</p>
      <input type="hidden" name="locale" value={locale} />
      <FormField id="password-email" name="email" type="email" autoComplete="username" required label={labels.email} value={email} onChange={(e) => setEmail(e.target.value)} />
      <FormField id="password-current" name="password" type="password" autoComplete="current-password" required label={labels.password} />
      <Turnstile siteKey={turnstileSiteKey} locale={locale} />
      <FormError message={state ? labels.errors[state.status] : undefined} />
      <SubmitButton label={labels.submit} pendingLabel={labels.pending} className="justify-self-stretch" />
      <a href={forgotHref} className="justify-self-center text-sm text-primary underline underline-offset-4">
        {labels.forgot}
      </a>
    </form>
  );
}

/** "Forgot password": asks for the email link. */
export function PasswordResetRequestForm({
  locale,
  action,
  turnstileSiteKey,
  labels,
}: {
  locale: string;
  action: (prev: PasswordResetRequestState, formData: FormData) => Promise<PasswordResetRequestState>;
  turnstileSiteKey?: string;
  labels: { email: string; send: string; sending: string; sent: string; invalidEmail: string; errors: Record<string, string> };
}) {
  const [state, submit] = useActionState(action, null);
  if (state?.status === "sent") {
    return (
      <p role="status" className="rounded-md border border-border p-4 text-sm">
        {labels.sent}
      </p>
    );
  }
  const error = state ? (state.status === "invalid_email" ? labels.invalidEmail : labels.errors[state.status]) : undefined;
  return (
    <form action={submit} className="grid gap-4" data-testid="password-reset-request" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormField id="reset-email" name="email" type="email" autoComplete="username" required label={labels.email} />
      <Turnstile siteKey={turnstileSiteKey} locale={locale} />
      <FormError message={error} />
      <SubmitButton label={labels.send} pendingLabel={labels.sending} className="justify-self-stretch" />
    </form>
  );
}

/** The new password from the emailed link (typed twice). */
export function NewPasswordForm({
  locale,
  token,
  action,
  labels,
}: {
  locale: string;
  token: string;
  action: (prev: NewPasswordState, formData: FormData) => Promise<NewPasswordState>;
  labels: { password: string; confirm: string; save: string; saving: string; errors: Record<string, string> };
}) {
  const [state, submit] = useActionState(action, null);
  return (
    <form action={submit} className="grid gap-4" data-testid="password-new">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <FormField id="new-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} label={labels.password} />
      <FormField id="new-password-confirm" name="confirm" type="password" autoComplete="new-password" required label={labels.confirm} />
      <FormError message={state ? labels.errors[state.status] : undefined} />
      <SubmitButton label={labels.save} pendingLabel={labels.saving} className="justify-self-stretch" />
    </form>
  );
}
