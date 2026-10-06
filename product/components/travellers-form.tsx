"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/config/app";
import { getBookingContent } from "../booking/content";
import type { Traveller } from "../schema/booking";

/** values: what the guest submitted (React resets a form after its action; the rows are refilled from these). */
export type TravellersState =
  | (({ status: "saved" } | { status: "invalid"; errors: Record<string, "required" | "invalid" | "too_long"> } | { status: "locked" | "error" }) & { values?: Record<string, string> })
  | null;

/**
 * Names and birth years of everyone on the trip (D7), one row per person in party order. Saved on the server with
 * the guest's secret token; rows keep what was typed when a row is invalid.
 */
export function TravellersForm({
  action,
  code,
  token,
  locale,
  kinds,
  initial,
}: {
  action: (prev: TravellersState, formData: FormData) => Promise<TravellersState>;
  code: string;
  token: string;
  locale: Locale;
  /** One entry per person: "adult" | "child" | "infant". */
  kinds: ("adult" | "child" | "infant")[];
  initial: Traveller[];
}) {
  const t = getBookingContent(locale).travellers;
  const [state, formAction, pending] = useActionState(action, null);
  const error = (key: string) => (state?.status === "invalid" ? state.errors[key] : undefined);
  const thisYear = new Date().getFullYear();
  return (
    // Re-mounted after each answer: React resets a form after its action, and the rows must show the submitted values.
    <form key={state ? JSON.stringify(state) : "initial"} action={formAction} className="mt-4 grid gap-3" data-testid="travellers-form" noValidate>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="locale" value={locale} />
      {kinds.map((kind, i) => {
        const nameError = error(`name_${i}`);
        const yearError = error(`year_${i}`);
        return (
          <fieldset key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_8rem]">
            <legend className="px-1 text-sm font-medium">{t.row(i + 1, t.kinds[kind])}</legend>
            <div>
              <label htmlFor={`traveller-name-${i}`} className="text-sm">
                {t.name}
              </label>
              <Input
                id={`traveller-name-${i}`}
                name={`name_${i}`}
                defaultValue={state?.values?.[`name_${i}`] ?? initial[i]?.name ?? ""}
                autoComplete={i === 0 ? "name" : "off"}
                maxLength={100}
                className="mt-1"
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? `traveller-name-${i}-error` : undefined}
              />
              {nameError && (
                <span id={`traveller-name-${i}-error`} className="mt-1 block text-sm text-danger">
                  {t.errors[nameError]}
                </span>
              )}
            </div>
            <div>
              <label htmlFor={`traveller-year-${i}`} className="text-sm">
                {t.birthYear}
              </label>
              <Input
                id={`traveller-year-${i}`}
                name={`year_${i}`}
                inputMode="numeric"
                placeholder={String(thisYear - (kind === "adult" ? 30 : kind === "child" ? 8 : 2))}
                defaultValue={state?.values?.[`year_${i}`] ?? (initial[i]?.birthYear ? String(initial[i]!.birthYear) : "")}
                maxLength={4}
                className="mt-1"
                aria-invalid={yearError ? true : undefined}
                aria-describedby={yearError ? `traveller-year-${i}-error` : undefined}
              />
              {yearError && (
                <span id={`traveller-year-${i}-error`} className="mt-1 block text-sm text-danger">
                  {t.errors[yearError]}
                </span>
              )}
            </div>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} data-testid="travellers-save">
          {t.save}
        </Button>
        <p role="status" className="text-sm">
          {state?.status === "saved" && <span className="text-success">{t.saved}</span>}
          {state?.status === "locked" && <span className="text-danger">{t.locked}</span>}
          {state?.status === "error" && <span className="text-danger">{t.error}</span>}
          {state?.status === "invalid" && <span className="text-danger">{t.fixRows}</span>}
        </p>
      </div>
    </form>
  );
}
