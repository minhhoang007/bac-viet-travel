"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/cn";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import type { Locale } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { formatDay, formatVnd, getBookingContent } from "../booking/content";
import { DEFAULT_TOUR_PRICING, privateQuote, privateTier, quote, type PrivatePricing, type TourPricing } from "../booking/rules";
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

/** Private mode: the guest picks any date in [minDate, maxDate] and the group size; price per person by tier. */
export interface PrivateTourOption {
  tourSlug: string;
  pricing: PrivatePricing;
  minDate: string;
  maxDate: string;
}

export interface BookingFormProps {
  action: (prev: State, formData: FormData) => Promise<State>;
  departures: DepartureOption[];
  initialDepartureId?: string;
  /** Adults preselected from the search (?guests=). */
  initialAdults?: number;
  /** Shown at the top of the summary. */
  tour?: { title: string; image: string; duration: string };
  locale: Locale;
  /** Set: private tour form (no departure list). */
  privateTour?: PrivateTourOption;
  /** Child %, infant price, single room supplement of the tour (defaults when absent). */
  pricing?: TourPricing;
}

const noopSubscribe = () => () => {};

export function BookingForm({
  action,
  departures,
  initialDepartureId,
  initialAdults,
  tour,
  locale,
  privateTour,
  pricing = DEFAULT_TOUR_PRICING,
}: BookingFormProps) {
  const t = getBookingContent(locale);
  const [state, formAction, pending] = useActionState(action, null);
  const firstBookable = departures.find((d) => d.bookable)?.id;
  const [departureId, setDepartureId] = useState(
    departures.some((d) => d.id === initialDepartureId && d.bookable)
      ? initialDepartureId
      : firstBookable,
  );
  const [adults, setAdults] = useState(initialAdults ?? 2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [singleRooms, setSingleRooms] = useState(0);
  const party = { adults, children, infants, singleRooms };
  // Prices and limits update only once React runs; tests wait for this marker before typing.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // The date list scrolls inside its box: bring the preselected date (from the tour page) into view, once.
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const box = list.current;
    const picked = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (box && picked) box.scrollTop = picked.offsetTop - box.offsetTop - 8;
  }, []);
  const [date, setDate] = useState(privateTour?.minDate ?? "");
  const group = departures.find((d) => d.id === departureId);
  // One shape for both modes: the chosen day, and the quote for it.
  const chosen = privateTour ? (date ? { date } : undefined) : group;
  const q = privateTour
    ? privateQuote(privateTour.pricing, party, pricing)
    : group
      ? quote(group.unitPriceVnd, party, pricing)
      : null;
  const guestsOutOfRange = Boolean(privateTour) && q === null;

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
        className="mt-1 block text-sm text-danger"
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

  if (!privateTour && departures.length === 0)
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
      data-hydrated={hydrated || undefined}
    >
      <input type="hidden" name="locale" value={locale} />
      {privateTour ? (
        <input type="hidden" name="tourSlug" value={privateTour.tourSlug} />
      ) : (
        <input type="hidden" name="departureId" value={departureId ?? ""} />
      )}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-8">
{privateTour ? (
        <fieldset>
          <legend className="flex items-center text-lg font-semibold"><span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">1</span>{t.privateDateTitle}</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-[220px_1fr]">
            <div>
              <Label htmlFor="booking-date">{t.privateDate}</Label>
              <Input
                {...aria("date")}
                type="date"
                min={privateTour.minDate}
                max={privateTour.maxDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
                required
              />
              {message("date")}
            </div>
            <div className="text-sm">
              <p className="font-medium">{t.privateTiersTitle}</p>
              <ul className="mt-1 grid gap-1 text-muted-foreground" data-testid="private-tiers">
                {privateTour.pricing.tiers.map((tier, i) => {
                  const next = privateTour.pricing.tiers[i + 1];
                  const active = q !== null && privateTier(privateTour.pricing, adults + children) === tier;
                  return (
                    <li key={tier.minGuests} className={cn(active && "font-semibold text-foreground")}>
                      {t.tierLine(tier.minGuests, next ? next.minGuests - 1 : privateTour.pricing.maxGuests)}: {formatVnd(tier.vnd, locale)}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </fieldset>

        ) : (
        <fieldset>
          <legend className="flex items-center text-lg font-semibold"><span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">1</span>{t.departuresTitle}</legend>
          <ul
            className="mt-3 grid max-h-[28rem] gap-2 overflow-y-auto rounded-lg p-0.5 sm:grid-cols-2"
            data-testid="departures"
            ref={list}
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
                            ? "font-semibold text-danger"
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
        )}

        <fieldset className="grid gap-4">
          <legend className="flex items-center text-lg font-semibold"><span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">2</span>{t.guestsTitle}</legend>
          <div className="grid grid-cols-3 items-end gap-4">
            <div>
              <Label htmlFor="booking-adults">{t.adults}</Label>
              <Input
                {...aria("adults")}
                type="number"
                min={1}
                max={privateTour?.pricing.maxGuests ?? 10}
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
                value={infants}
                onChange={(e) => setInfants(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1"
              />
              {message("infants")}
            </div>
            {pricing.singleSupplementVnd > 0 && (
              <div>
                <Label htmlFor="booking-singleRooms">{t.singleRooms}</Label>
                <Input
                  {...aria("singleRooms")}
                  type="number"
                  min={0}
                  max={adults + children}
                  value={singleRooms}
                  onChange={(e) => setSingleRooms(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1"
                />
                <span className="mt-1 block text-xs text-muted-foreground">{t.singleRoomsHint(formatVnd(pricing.singleSupplementVnd, locale))}</span>
                {message("singleRooms")}
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="flex items-center text-lg font-semibold"><span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">3</span>{t.formTitle}</legend>
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
        {tour && (
          <div className="mb-4 flex gap-3 border-b border-border pb-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
              <Image src={tour.image} alt="" fill sizes="64px" className="object-cover" />
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-semibold leading-snug">{tour.title}</p>
              <p className="mt-1 text-muted-foreground">{tour.duration}</p>
            </div>
          </div>
        )}
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
                  <dt>{t.childLine(children, pricing.childPercent)}</dt>
                  <dd>{formatVnd(children * q.childPriceVnd, locale)}</dd>
                </div>
              )}
              {infants > 0 && (
                <div className="flex justify-between">
                  <dt>{t.infantLine(infants, q.infantPriceVnd === 0)}</dt>
                  <dd>{formatVnd(infants * q.infantPriceVnd, locale)}</dd>
                </div>
              )}
              {q.singleRooms > 0 && (
                <div className="flex justify-between">
                  <dt>{t.singleLine(q.singleRooms)}</dt>
                  <dd>{formatVnd(q.singleRooms * q.singleSupplementVnd, locale)}</dd>
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
        <section className="mt-4 rounded-lg bg-muted p-3 text-xs" aria-labelledby="booking-policy" data-testid="booking-policy">
          <h3 id="booking-policy" className="font-semibold">
            {t.policyTitle}
          </h3>
          <ul className="mt-2 grid gap-1.5">
            {t.policy.map((line) => (
              <li key={line} className="flex gap-2">
                <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
                {line}
              </li>
            ))}
          </ul>
          <a href={localePath(locale, "/cancellation")} target="_blank" className="mt-2 inline-block underline">
            {t.policyLink}
          </a>
        </section>
        <div className="mt-4 text-sm">
          <label className="flex items-start gap-2">
            <input
              {...aria("agree")}
              type="checkbox"
              required
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              {t.agree.before}
              <a href={localePath(locale, "/terms")} target="_blank" className="underline">
                {t.agree.terms}
              </a>
              {t.agree.and}
              <a href={localePath(locale, "/cancellation")} target="_blank" className="underline">
                {t.agree.cancellation}
              </a>
              {t.agree.after}
            </span>
          </label>
          {message("agree")}
        </div>
        {guestsOutOfRange && privateTour && (
          <p className="mt-4 text-sm text-danger" data-testid="private-range">
            {t.privateRange(privateTour.pricing.tiers[0]!.minGuests, privateTour.pricing.maxGuests)}
          </p>
        )}
        {formError && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
          >
            {formError}
          </p>
        )}
        <Button
          type="submit"
          className="mt-4 w-full"
          disabled={pending || !chosen || !q}
        >
          {pending ? t.sending : t.submit}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">{t.nextStep}</p>
      </aside>
    </form>
  );
}
