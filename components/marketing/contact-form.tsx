"use client";

import { useActionState } from "react";
import type { ContactResult } from "@/core/contact";

type Field = "name" | "email" | "message";

export interface ContactFormLabels {
  name: string;
  email: string;
  message: string;
  submit: string;
  sending: string;
  success: string;
  errors: { required: string; invalid_email: string; too_long: string; rate_limited: string; error: string };
}

export interface ContactFormProps {
  action: (prev: ContactResult | null, formData: FormData) => Promise<ContactResult>;
  labels: ContactFormLabels;
  /** Prefilled values, e.g. the tour a visitor asks about. */
  defaults?: Partial<Record<Field, string>>;
}

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary";

export function ContactForm({ action, labels, defaults }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, null);

  if (state?.status === "success") {
    return (
      <p role="status" className="rounded-md border border-border p-4">
        {labels.success}
      </p>
    );
  }

  const fieldError = (field: Field) => {
    const code = state?.status === "invalid" ? state.fieldErrors[field] : undefined;
    return code ? labels.errors[code] : undefined;
  };
  const formError =
    state?.status === "rate_limited" ? labels.errors.rate_limited : state?.status === "error" ? labels.errors.error : undefined;

  const fields: { name: Field; label: string; type?: string; multiline?: boolean }[] = [
    { name: "name", label: labels.name },
    { name: "email", label: labels.email, type: "email" },
    { name: "message", label: labels.message, multiline: true },
  ];

  return (
    <form action={formAction} className="mx-auto grid max-w-lg gap-4 text-left" noValidate>
      {fields.map((f) => {
        const error = fieldError(f.name);
        const common = {
          id: `contact-${f.name}`,
          name: f.name,
          defaultValue: defaults?.[f.name],
          className: inputClass,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error ? `contact-${f.name}-error` : undefined,
        };
        return (
          <label key={f.name} htmlFor={common.id} className="text-sm font-medium">
            {f.label}
            {f.multiline ? <textarea rows={5} {...common} /> : <input type={f.type ?? "text"} {...common} />}
            {error && (
              <span id={`contact-${f.name}-error`} className="mt-1 block text-sm text-red-600">
                {error}
              </span>
            )}
          </label>
        );
      })}
      {/* Honeypot, hidden from humans and assistive tech */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? labels.sending : labels.submit}
      </button>
    </form>
  );
}
