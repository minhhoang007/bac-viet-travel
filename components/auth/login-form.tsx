"use client";

import { useActionState } from "react";
import { FormError } from "@/components/forms/form-error";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";

type State = { status: "sent" } | { status: "invalid_email" } | { status: "rate_limited" } | { status: "error" } | null;

export interface LoginFormProps {
  locale: string;
  sendMagicLink: (prev: State, formData: FormData) => Promise<State>;
  labels: {
    email: string;
    sendLink: string;
    sending: string;
    linkSent: string;
    errors: { invalid_email: string; rate_limited: string; error: string };
  };
}

export function LoginForm({ locale, sendMagicLink, labels }: LoginFormProps) {
  const [state, action] = useActionState(sendMagicLink, null);

  if (state?.status === "sent") {
    return (
      <p role="status" className="rounded-md border border-border p-4 text-sm">
        {labels.linkSent}
      </p>
    );
  }
  // "sent" returned above, so any remaining state is an error code.
  const error = state ? labels.errors[state.status] : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormField id="login-email" name="email" type="email" autoComplete="email" required label={labels.email} />
      <FormError message={error} />
      <SubmitButton label={labels.sendLink} pendingLabel={labels.sending} className="justify-self-stretch" />
    </form>
  );
}
