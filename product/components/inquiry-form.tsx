"use client";

import { useActionState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { InquiryError, InquiryField, InquiryResult } from "../tours/inquiry";

export interface InquiryFormLabels {
  name: string;
  email: string;
  phone: string;
  channel: string;
  channels: { zalo: string; whatsapp: string; phone: string; email: string };
  date: string;
  datePlaceholder: string;
  adults: string;
  children: string;
  note: string;
  submit: string;
  sending: string;
  success: string;
  errors: Record<InquiryError | "rate_limited" | "error", string>;
}

export interface InquiryFormProps {
  action: (prev: InquiryResult | null, formData: FormData) => Promise<InquiryResult>;
  labels: InquiryFormLabels;
  tour: string;
  locale: "vi" | "en";
}

const input = "mt-1";

export function InquiryForm({ action, labels, tour, locale }: InquiryFormProps) {
  const [state, formAction, pending] = useActionState(action, null);

  if (state?.status === "success") {
    return (
      <p role="status" data-inquiry="success" className="rounded-md border border-border bg-muted p-4 text-sm">
        {labels.success}
      </p>
    );
  }

  const error = (field: InquiryField) => {
    const code = state?.status === "invalid" ? state.fieldErrors[field] : undefined;
    return code ? labels.errors[code] : undefined;
  };
  const formError = state?.status === "rate_limited" ? labels.errors.rate_limited : state?.status === "error" ? labels.errors.error : undefined;
  const field = (name: InquiryField) => ({
    id: `inquiry-${name}`,
    name,
    className: input,
    "aria-invalid": error(name) ? true : undefined,
    "aria-describedby": error(name) ? `inquiry-${name}-error` : undefined,
  });
  const message = (name: InquiryField) =>
    error(name) && (
      <span id={`inquiry-${name}-error`} className="mt-1 block text-sm text-red-600">
        {error(name)}
      </span>
    );
  // Vietnamese visitors usually answer on Zalo, international visitors on WhatsApp.
  const channels = (locale === "vi" ? ["zalo", "phone", "whatsapp", "email"] : ["whatsapp", "email", "phone", "zalo"]) as (keyof InquiryFormLabels["channels"])[];

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="tour" value={tour} />
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor="inquiry-name" className="text-sm font-medium">
        {labels.name}
        <Input {...field("name")} autoComplete="name" />
        {message("name")}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor="inquiry-email" className="text-sm font-medium">
          {labels.email}
          <Input {...field("email")} type="email" autoComplete="email" />
          {message("email")}
        </label>
        <label htmlFor="inquiry-phone" className="text-sm font-medium">
          {labels.phone}
          <Input {...field("phone")} type="tel" autoComplete="tel" />
          {message("phone")}
        </label>
      </div>
      <fieldset className="text-sm">
        <legend className="font-medium">{labels.channel}</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {channels.map((c, i) => (
            <label key={c} className="inline-flex items-center gap-1.5">
              <input type="radio" name="channel" value={c} defaultChecked={i === 0} />
              {labels.channels[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr_1fr]">
        <label htmlFor="inquiry-date" className="text-sm font-medium">
          {labels.date}
          {/* Past days are disabled in the calendar and rejected again by the server. */}
          <DatePicker
            id="inquiry-date"
            name="date"
            locale={locale}
            placeholder={labels.datePlaceholder}
            futureOnly
            aria-invalid={error("date") ? true : undefined}
            aria-describedby={error("date") ? "inquiry-date-error" : undefined}
          />
          {message("date")}
        </label>
        <label htmlFor="inquiry-adults" className="text-sm font-medium">
          {labels.adults}
          <Input {...field("adults")} type="number" min={1} max={50} defaultValue={2} />
          {message("adults")}
        </label>
        <label htmlFor="inquiry-children" className="text-sm font-medium">
          {labels.children}
          <Input {...field("children")} type="number" min={0} max={50} defaultValue={0} />
          {message("children")}
        </label>
      </div>
      <label htmlFor="inquiry-note" className="text-sm font-medium">
        {labels.note}
        <Textarea {...field("note")} rows={3} />
        {message("note")}
      </label>
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
