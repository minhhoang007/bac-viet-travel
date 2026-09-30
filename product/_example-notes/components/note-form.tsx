"use client";

import { useActionState } from "react";
import type { NoteFormState } from "../actions";

export interface NoteFormProps {
  locale: string;
  action: (prev: NoteFormState, formData: FormData) => Promise<NoteFormState>;
  note?: { id: string; title: string; body: string };
  labels: { titleLabel: string; bodyLabel: string; submit: string; errors: { required: string; too_long: string; error: string } };
}

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

export function NoteForm({ locale, action, note, labels }: NoteFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const message = state ? labels.errors[state.code] : undefined;

  return (
    <form action={formAction} className="grid max-w-xl gap-3">
      <input type="hidden" name="locale" value={locale} />
      {note && <input type="hidden" name="id" value={note.id} />}
      <label htmlFor="note-title" className="text-sm font-medium">
        {labels.titleLabel}
        <input id="note-title" name="title" defaultValue={note?.title} maxLength={200} className={inputClass} />
      </label>
      <label htmlFor="note-body" className="text-sm font-medium">
        {labels.bodyLabel}
        <textarea id="note-body" name="body" rows={4} defaultValue={note?.body} className={inputClass} />
      </label>
      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-10 justify-self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
