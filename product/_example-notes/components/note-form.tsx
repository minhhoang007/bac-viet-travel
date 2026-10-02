"use client";

import { useActionState } from "react";
import { FormError } from "@/components/forms/form-error";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import type { NoteFormState } from "../actions";

export interface NoteFormProps {
  locale: string;
  action: (prev: NoteFormState, formData: FormData) => Promise<NoteFormState>;
  note?: { id: string; title: string; body: string };
  labels: { titleLabel: string; bodyLabel: string; submit: string; errors: { required: string; too_long: string; error: string } };
}

export function NoteForm({ locale, action, note, labels }: NoteFormProps) {
  const [state, formAction] = useActionState(action, null);
  // Message keys come from the zod schema (validations.ts); anything else shows the generic error.
  const message = (code?: string) => (code ? (labels.errors[code as keyof typeof labels.errors] ?? labels.errors.error) : undefined);
  const fieldErrors = state?.status === "invalid" ? state.fieldErrors : {};

  return (
    <form action={formAction} className="grid max-w-xl gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {note && <input type="hidden" name="id" value={note.id} />}
      <FormField id="note-title" name="title" label={labels.titleLabel} defaultValue={note?.title} maxLength={200} error={message(fieldErrors.title)} />
      <FormField id="note-body" name="body" label={labels.bodyLabel} defaultValue={note?.body} multiline error={message(fieldErrors.body)} />
      <FormError message={state?.status === "error" ? labels.errors.error : undefined} />
      <SubmitButton label={labels.submit} />
    </form>
  );
}
