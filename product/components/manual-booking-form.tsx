"use client";

import { useActionState } from "react";
import type { ManualBookingState } from "@/app/actions/booking-admin";
import type { Locale } from "@/config/app";
import { getBookingAdminContent } from "../booking/admin-content";
import { MANUAL_SOURCES } from "../booking/sources";

export interface ManualDepartureOption {
  id: string;
  label: string;
  seatsLeft: number;
}

/** Staff form for bookings paid outside the website (phone, Zalo, OTA). */
export function ManualBookingForm({
  locale,
  departures,
  action,
  canConfirm = true,
}: {
  locale: Locale;
  departures: ManualDepartureOption[];
  /** Staff with bookings.confirm: may enter a booking as confirmed (others: deposit paid only). */
  canConfirm?: boolean;
  action: (state: ManualBookingState, formData: FormData) => Promise<ManualBookingState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const c = getBookingAdminContent(locale);
  const m = c.manual;
  const fieldError = (name: string) => (state?.status === "invalid" ? state.fieldErrors[name] : undefined);
  const input = "mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm";
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="grid text-sm">
      {label}
      <input
        id={`manual-${name}`}
        name={name}
        aria-invalid={fieldError(name) ? true : undefined}
        aria-describedby={fieldError(name) ? `manual-${name}-error` : undefined}
        className={input}
        {...props}
      />
      {fieldError(name) && (
        <span id={`manual-${name}-error`} className="mt-1 text-danger">
          {m.errors[fieldError(name)!] ?? m.errors.invalid}
        </span>
      )}
    </label>
  );

  if (departures.length === 0) return <p className="text-sm text-muted-foreground">{m.noDepartures}</p>;

  return (
    <form action={formAction} className="grid max-w-2xl gap-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {state?.status === "sold_out" && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {m.soldOut(state.seatsLeft)}
        </p>
      )}
      {(state?.status === "unavailable" || state?.status === "error") && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {state.status === "unavailable" ? m.unavailable : c.result.failed}
        </p>
      )}

      <label className="grid text-sm">
        {m.departure}
        <select name="departureId" required className={input}>
          {departures.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid text-sm">
          {c.source}
          <select name="source" required defaultValue="klook" className={input}>
            {MANUAL_SOURCES.map((s) => (
              <option key={s} value={s}>
                {c.sources[s]}
              </option>
            ))}
          </select>
        </label>
        {field("externalRef", m.externalRef, { maxLength: 100 })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {field("name", m.name, { required: true, maxLength: 100 })}
        {field("phone", m.phone, { type: "tel", maxLength: 30 })}
        {field("email", m.email, { type: "email", maxLength: 200 })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {field("adults", m.adults, { type: "number", min: 1, max: 50, defaultValue: 1, required: true })}
        {field("children", m.children, { type: "number", min: 0, max: 50, defaultValue: 0 })}
        {field("infants", m.infants, { type: "number", min: 0, max: 20, defaultValue: 0 })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {field("amountVnd", m.amount, { type: "number", min: 0, step: 1000, required: true })}
        <label className="grid text-sm">
          {m.status}
          <select name="status" defaultValue={canConfirm ? "confirmed" : "deposit_paid"} className={input}>
            {canConfirm && <option value="confirmed">{m.statusConfirmed}</option>}
            <option value="deposit_paid">{m.statusPaid}</option>
          </select>
          {fieldError("status") && <span className="mt-1 text-danger">{m.errors[fieldError("status")!] ?? m.errors.invalid}</span>}
        </label>
      </div>

      <label className="grid text-sm">
        {m.note}
        <textarea name="note" rows={3} maxLength={1000} className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="guestEmails" className="mt-0.5 size-4" />
        <span>{m.guestEmails}</span>
      </label>

      <button type="submit" disabled={pending} className="h-10 w-fit rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {m.submit}
      </button>
    </form>
  );
}
