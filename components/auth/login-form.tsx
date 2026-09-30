"use client";

import { useActionState } from "react";

type State = { status: "sent" } | { status: "invalid_email" } | { status: "error" } | null;

export interface LoginFormProps {
  locale: string;
  sendMagicLink: (prev: State, formData: FormData) => Promise<State>;
  labels: { email: string; sendLink: string; sending: string; linkSent: string; errors: { invalid_email: string; error: string } };
}

export function LoginForm({ locale, sendMagicLink, labels }: LoginFormProps) {
  const [state, action, pending] = useActionState(sendMagicLink, null);

  if (state?.status === "sent") {
    return (
      <p role="status" className="rounded-md border border-border p-4 text-sm">
        {labels.linkSent}
      </p>
    );
  }
  const error = state?.status === "invalid_email" ? labels.errors.invalid_email : state?.status === "error" ? labels.errors.error : undefined;

  return (
    <form action={action} className="grid gap-3" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor="login-email" className="text-sm font-medium">
        {labels.email}
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={error ? true : undefined}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? labels.sending : labels.sendLink}
      </button>
    </form>
  );
}
