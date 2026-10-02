"use client";

import { useActionState } from "react";
import type { ContactResult } from "@/core/contact";
import { FormError } from "@/components/forms/form-error";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";

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

export function ContactForm({ action, labels, defaults }: ContactFormProps) {
  const [state, formAction] = useActionState(action, null);

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
      {fields.map((f) => (
        <FormField
          key={f.name}
          id={`contact-${f.name}`}
          name={f.name}
          label={f.label}
          defaultValue={defaults?.[f.name]}
          error={fieldError(f.name)}
          {...(f.multiline ? { multiline: true, rows: 5 } : { type: f.type ?? "text" })}
        />
      ))}
      {/* Honeypot, hidden from humans and assistive tech */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <FormError message={formError} />
      <SubmitButton label={labels.submit} pendingLabel={labels.sending} className="justify-self-stretch sm:justify-self-start" />
    </form>
  );
}
