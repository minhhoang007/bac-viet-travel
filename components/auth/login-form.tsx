"use client";

import Script from "next/script";
import { useActionState, useEffect, useState } from "react";
import type { LoginCodeState } from "@/app/actions/security";
import { FormError } from "@/components/forms/form-error";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";

type State = { status: "sent" } | { status: "invalid_email" } | { status: "rate_limited" } | { status: "captcha" } | { status: "error" } | null;

export interface LoginFormProps {
  locale: string;
  sendMagicLink: (prev: State, formData: FormData) => Promise<State>;
  /** The 6-digit code from the email (sign in on another device than the one reading it). */
  signInWithCode?: (prev: LoginCodeState, formData: FormData) => Promise<LoginCodeState>;
  /** Cloudflare Turnstile site key: shows the bot check (the server verifies it). */
  turnstileSiteKey?: string;
  labels: {
    email: string;
    sendLink: string;
    sending: string;
    linkSent: string;
    errors: { invalid_email: string; rate_limited: string; error: string; captcha: string };
    code?: { title: string; hint: string; label: string; submit: string; wrong: string };
  };
}

export function LoginForm({ locale, sendMagicLink, signInWithCode, turnstileSiteKey, labels }: LoginFormProps) {
  const [state, action] = useActionState(sendMagicLink, null);
  const [email, setEmail] = useState("");

  if (state?.status === "sent") {
    return (
      <div className="grid gap-6">
        <p role="status" className="rounded-md border border-border p-4 text-sm">
          {labels.linkSent}
        </p>
        {signInWithCode && labels.code && <CodeForm email={email} action={signInWithCode} labels={labels.code} rateLimited={labels.errors.rate_limited} failed={labels.errors.error} />}
      </div>
    );
  }
  // "sent" returned above, so any remaining state is an error code.
  const error = state ? labels.errors[state.status] : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormField id="login-email" name="email" type="email" autoComplete="email webauthn" required label={labels.email} value={email} onChange={(e) => setEmail(e.target.value)} />
      {turnstileSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
          {/* Turnstile adds a hidden "cf-turnstile-response" field to this form. */}
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-language={locale} />
        </>
      )}
      <FormError message={error} />
      <SubmitButton label={labels.sendLink} pendingLabel={labels.sending} className="justify-self-stretch" />
    </form>
  );
}

function CodeForm({ email, action, labels, rateLimited, failed }: { email: string; action: (prev: LoginCodeState, formData: FormData) => Promise<LoginCodeState>; labels: NonNullable<LoginFormProps["labels"]["code"]>; rateLimited: string; failed: string }) {
  const [state, submit] = useActionState(action, null);
  // A right code gives the one-time link: open it in the browser (a real navigation brings the session cookie here).
  useEffect(() => {
    if (state?.status === "ok") window.location.assign(state.link);
  }, [state]);
  const error = state?.status === "wrong" ? labels.wrong : state?.status === "rate_limited" ? rateLimited : state?.status === "error" ? failed : undefined;
  return (
    <form action={submit} className="grid gap-3" data-testid="login-code">
      <div>
        <p className="font-medium">{labels.title}</p>
        <p className="text-sm text-muted-foreground">{labels.hint}</p>
      </div>
      <input type="hidden" name="email" value={email} />
      <FormField id="login-code" name="code" inputMode="numeric" autoComplete="one-time-code" required label={labels.label} />
      <FormError message={error} />
      <SubmitButton label={labels.submit} className="justify-self-stretch" />
    </form>
  );
}
