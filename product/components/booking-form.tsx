"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/cn";
import type { Locale } from "@/config/app";
import { formatDay, formatVnd, getBookingContent } from "../booking/content";
import { quote } from "../booking/rules";
import type { BookingField, HoldResult } from "../booking/service";

export interface DepartureOption {
  id: string;
  date: string;
  seatsLeft: number;
  unitPriceVnd: number;
  bookable: boolean;
  status: "open" | "closed";
}

type State =
  Exclude<HoldResult, { status: "held" }> | { status: "error" } | null;

export interface BookingFormProps {
  action: (prev: State, formData: FormData) => Promise<State>;
  departures: DepartureOption[];
  initialDepartureId?: string;
  locale: Locale;
}

export function BookingForm({
  action,
  departures,
  initialDepartureId,
  locale,
}: BookingFormProps) {
  const t = getBookingContent(locale);
  const [state, formAction, pending] = useActionState(action, null);
  const firstBookable = departures.find((d) => d.bookable)?.id;
  const [departureId, setDepartureId] = useState(
    departures.some((d) => d.id === initialDepartureId && d.bookable)
      ? initialDepartureId
      : firstBookable,
  );
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const chosen = departures.find((d) => d.id === departureId);
  const q = chosen ? quote(chosen.unitPriceVnd, { adults, children }) : null;

  const error = (field: BookingField) => {
    const code =
      state?.status === "invalid" ? state.fieldErrors[field] : undefined;
    return code ? t.errors[code] : undefined;
  };
  const formError =
    state?.status === "sold_out"
      ? t.errors.sold_out(state.seatsLeft)
      : state?.status === "unavailable"
        ? t.errors.unavailable
        : state?.status === "rate_limited"
          ? t.errors.rate_limited
          : state?.status === "error"
            ? t.errors.error
            : undefined;
  const aria = (name: BookingField) => ({
    id: `booking-${name}`,
    name,
    "aria-invalid": error(name) ? true : undefined,
    "aria-describedby": error(name) ? `booking-${name}-error` : undefined,
  });
  const message = (name: BookingField) =>
    error(name) && (
      <span
        id={`booking-${name}-error`}
        className="mt-1 block text-sm text-red-700"
      >
        {error(name)}
      </span>
    );
  const badge = (d: DepartureOption) =>
    d.status === "closed"
      ? t.closed
      : d.seatsLeft === 0
        ? t.soldOut
        : d.bookable
          ? t.seatsLeft(d.seatsLeft)
          : t.tooSoon;

  if (departures.length === 0)
    return (
      <p className="rounded-md border border-border bg-muted p-4 text-sm">
        {t.noDepartures}
      </p>
    );

  return (
    <form
      action={formAction}
      className="relative grid gap-8 lg:grid-cols-[1fr_340px]"
      noValidate
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="departureId" value={departureId ?? ""} />
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-8">
        <fieldset>
          <legend className="text-lg font-semibold">{t.departuresTitle}</legend>
          <ul
            className="mt-3 grid gap-2 sm:grid-cols-2"
            data-testid="departures"
          >
            {departures.map((d) => {
              const selected = d.id === departureId;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    disabled={!d.bookable}
                    aria-pressed={selected}
                    data-departure={d.date}
                    onClick={() => setDepartureId(d.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "border-border hover:border-primary/60",
                      !d.bookable &&
                        "cursor-not-allowed bg-muted text-muted-foreground hover:border-border",
                    )}
                  >
                    <span>
                      <span className="block font-medium capitalize">
                        {formatDay(d.date, locale)}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          d.bookable && d.seatsLeft <= 5
                            ? "font-semibold text-red-700"
                            : "text-muted-foreground",
                        )}
                      >
                        {badge(d)}
                      </span>
                    </span>
                    <span className="font-semibold">
                      {formatVnd(d.unitPriceVnd, locale)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {message("departureId")}
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="text-lg font-semibold">{t.formTitle}</legend>
          <div>
            <Label htmlFor="booking-name">{t.name}</Label>
            <Input
              {...aria("name")}
              autoComplete="name"
              className="mt-1"
              required
            />
            {message("name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="booking-email">{t.email}</Label>
              <Input
                {...aria("email")}
                type="email"
                autoComplete="email"
                className="mt-1"
                required
              />
              {message("email")}
            </div>
            <div>
              <Label htmlFor="booking-phone">{t.phone}</Label>
              <Input
                {...aria("phone")}
                type="tel"
                autoComplete="tel"
                className="mt-1"
                required
              />
              {message("phone")}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="booking-adults">{t.adults}</Label>
              <Input
                {...aria("adults")}
                type="number"
                min={1}
                max={10}
                value={adults}
                onChange={(e) =>
                  setAdults(Math.max(0, Number(e.target.value) || 0))
                }
                className="mt-1"
              />
              {message("adults")}
            </div>
            <div>
              <Label htmlFor="booking-children">{t.children}</Label>
              <Input
                {...aria("children")}
                type="number"
                min={0}
                max={9}
                value={children}
                onChange={(e) =>
                  setChildren(Math.max(0, Number(e.target.value) || 0))
                }
                className="mt-1"
              />
              {message("children")}
            </div>
            <div>
              <Label htmlFor="booking-infants">{t.infants}</Label>
              <Input
                {...aria("infants")}
                type="number"
                min={0}
                max={4}
                defaultValue={0}
                className="mt-1"
              />
              {message("infants")}
            </div>
          </div>
          <div>
            <Label htmlFor="booking-note">{t.note}</Label>
            <Textarea {...aria("note")} rows={3} className="mt-1" />
            {message("note")}
          </div>
        </fieldset>
      </div>

      <aside
        className="h-fit rounded-xl border border-border p-5 shadow-sm lg:sticky lg:top-6"
        aria-live="polite"
      >
        <h2 className="font-semibold">{t.summary}</h2>
        {chosen && q && (
          <div className="mt-3 grid gap-2 text-sm" data-testid="quote">
            <p className="font-medium capitalize">
              {formatDay(chosen.date, locale)}
            </p>
            <dl className="grid gap-2">
              <div className="flex justify-between">
                <dt>{t.adultLine(adults)}</dt>
                <dd>{formatVnd(adults * q.unitPriceVnd, locale)}</dd>
              </div>
              {children > 0 && (
                <div className="flex justify-between">
                  <dt>{t.childLine(children)}</dt>
                  <dd>{formatVnd(children * q.childPriceVnd, locale)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <dt>{t.total}</dt>
                <dd data-testid="total">{formatVnd(q.totalVnd, locale)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold text-primary">
                <dt>{t.deposit}</dt>
                <dd data-testid="deposit">{formatVnd(q.depositVnd, locale)}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              {t.rest}. {t.vndNote}
            </p>
          </div>
        )}
        {formError && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {formError}
          </p>
        )}
        <Button
          type="submit"
          className="mt-4 w-full"
          disabled={pending || !chosen}
        >
          {pending ? t.sending : t.submit}
        </Button>
      </aside>
    </form>
  );
}
