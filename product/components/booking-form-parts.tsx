"use client";

// Pieces of the booking form (booking-form.tsx): field helpers, the two date steps, the party step, the discount
// field and the summary. They hold no booking state of their own except the discount preview.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/cn";
import type { Locale } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { formatDay, formatVnd, getBookingContent } from "../booking/content";
import { applyDiscount, privateTier, type Discount, type PrivatePricing, type Quote } from "../booking/rules";
import type { BookingField, HoldResult } from "../booking/service";
import type { Addon } from "../tours/model";

type Content = ReturnType<typeof getBookingContent>;
export type FormState = Exclude<HoldResult, { status: "held" }> | { status: "error" } | null;
export type Party = { adults: number; children: number; infants: number; singleRooms: number; addons: Record<string, number> };

export interface DepartureOption {
  id: string;
  date: string;
  seatsLeft: number;
  unitPriceVnd: number;
  bookable: boolean;
  status: "open" | "closed";
}

/** Error text, ids and aria attributes of each field from the last server answer. */
export function fieldHelpers(state: FormState, t: Content) {
  const error = (field: BookingField) => {
    const code = state?.status === "invalid" ? state.fieldErrors[field] : undefined;
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
      <span id={`booking-${name}-error`} className="mt-1 block text-sm text-danger">
        {error(name)}
      </span>
    );
  return { formError, aria, message };
}
type Fields = ReturnType<typeof fieldHelpers>;

export function StepLegend({ n, children }: { n: number; children: ReactNode }) {
  return (
    <legend className="flex items-center text-lg font-semibold">
      <span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">
        {n}
      </span>
      {children}
    </legend>
  );
}

/** Step 1, private tour: any date in the range, with the price tiers (the current one highlighted). */
export function PrivateDateStep(props: {
  t: Content;
  locale: Locale;
  fields: Fields;
  pricing: PrivatePricing;
  minDate: string;
  maxDate: string;
  date: string;
  onDate: (date: string) => void;
  /** Guests counted for the tier, or null when out of range. */
  guests: number | null;
}) {
  const { t, locale, fields, pricing } = props;
  return (
    <fieldset>
      <StepLegend n={1}>{t.privateDateTitle}</StepLegend>
      <div className="mt-3 grid gap-4 sm:grid-cols-[220px_1fr]">
        <div>
          <Label htmlFor="booking-date">{t.privateDate}</Label>
          <Input {...fields.aria("date")} type="date" min={props.minDate} max={props.maxDate} value={props.date} onChange={(e) => props.onDate(e.target.value)} className="mt-1" required />
          {fields.message("date")}
        </div>
        <div className="text-sm">
          <p className="font-medium">{t.privateTiersTitle}</p>
          <ul className="mt-1 grid gap-1 text-muted-foreground" data-testid="private-tiers">
            {pricing.tiers.map((tier, i) => {
              const next = pricing.tiers[i + 1];
              const active = props.guests !== null && privateTier(pricing, props.guests) === tier;
              return (
                <li key={tier.minGuests} className={cn(active && "font-semibold text-foreground")}>
                  {t.tierLine(tier.minGuests, next ? next.minGuests - 1 : pricing.maxGuests)}: {formatVnd(tier.vnd, locale)}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </fieldset>
  );
}

/** Step 1, group tour: the departure list (scrolls inside its box). */
export function DepartureStep(props: { t: Content; locale: Locale; fields: Fields; departures: DepartureOption[]; departureId?: string; onPick: (id: string) => void }) {
  const { t, locale, departures } = props;
  // Bring the preselected date (from the tour page) into view, once.
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const box = list.current;
    const picked = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (box && picked) box.scrollTop = picked.offsetTop - box.offsetTop - 8;
  }, []);
  const badge = (d: DepartureOption) => (d.status === "closed" ? t.closed : d.seatsLeft === 0 ? t.soldOut : d.bookable ? t.seatsLeft(d.seatsLeft) : t.tooSoon);
  return (
    <fieldset>
      <StepLegend n={1}>{t.departuresTitle}</StepLegend>
      <ul className="mt-3 grid max-h-[28rem] gap-2 overflow-y-auto rounded-lg p-0.5 sm:grid-cols-2" data-testid="departures" ref={list}>
        {departures.map((d) => {
          const selected = d.id === props.departureId;
          return (
            <li key={d.id}>
              <button
                type="button"
                disabled={!d.bookable}
                aria-pressed={selected}
                data-departure={d.date}
                onClick={() => props.onPick(d.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  selected ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border hover:border-primary/60",
                  !d.bookable && "cursor-not-allowed bg-muted text-muted-foreground hover:border-border",
                )}
              >
                <span>
                  <span className="block font-medium capitalize">{formatDay(d.date, locale)}</span>
                  <span className={cn("text-xs", d.bookable && d.seatsLeft <= 5 ? "font-semibold text-danger" : "text-muted-foreground")}>{badge(d)}</span>
                </span>
                <span className="font-semibold">{formatVnd(d.unitPriceVnd, locale)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {props.fields.message("departureId")}
    </fieldset>
  );
}

/** Step 2: guests by age, add-ons (B6) and single rooms. */
export function PartyStep(props: {
  t: Content;
  locale: Locale;
  fields: Fields;
  party: Party;
  onChange: (party: Party) => void;
  maxAdults: number;
  addons: Addon[];
  singleSupplementVnd: number;
}) {
  const { t, locale, fields, party, onChange } = props;
  const count = (value: string) => Math.max(0, Number(value) || 0);
  const set = (key: "adults" | "children" | "infants" | "singleRooms") => (e: { target: { value: string } }) => onChange({ ...party, [key]: count(e.target.value) });
  const setAddon = (id: string, qty: number) => onChange({ ...party, addons: { ...party.addons, [id]: qty } });
  const people = party.adults + party.children;
  return (
    <fieldset className="grid gap-4">
      <StepLegend n={2}>{t.guestsTitle}</StepLegend>
      <div className="grid grid-cols-3 items-end gap-4">
        <div>
          <Label htmlFor="booking-adults">{t.adults}</Label>
          <Input {...fields.aria("adults")} type="number" min={1} max={props.maxAdults} value={party.adults} onChange={set("adults")} className="mt-1" />
          {fields.message("adults")}
        </div>
        <div>
          <Label htmlFor="booking-children">{t.children}</Label>
          <Input {...fields.aria("children")} type="number" min={0} max={9} value={party.children} onChange={set("children")} className="mt-1" />
          {fields.message("children")}
        </div>
        <div>
          <Label htmlFor="booking-infants">{t.infants}</Label>
          <Input {...fields.aria("infants")} type="number" min={0} max={4} value={party.infants} onChange={set("infants")} className="mt-1" />
          {fields.message("infants")}
        </div>
        {props.addons.length > 0 && (
          <fieldset className="col-span-full grid gap-2" data-testid="addons">
            <legend className="text-sm font-medium">{t.addonsTitle}</legend>
            {props.addons.map((a) => {
              const price = formatVnd(a.vnd, locale);
              const id = `booking-addon-${a.id}`;
              const qty = party.addons[a.id] ?? 0;
              return a.per === "booking" ? (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" id={id} name={`addon_${a.id}`} value="1" checked={qty > 0} onChange={(e) => setAddon(a.id, e.target.checked ? 1 : 0)} />
                  {a.name[locale]} · {t.addonPerBooking(price)}
                </label>
              ) : (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <Input id={id} name={`addon_${a.id}`} type="number" min={0} max={people} value={qty} onChange={(e) => setAddon(a.id, count(e.target.value))} className="w-20" />
                  <label htmlFor={id}>
                    {a.name[locale]} · {t.addonPerPerson(price)}
                  </label>
                </div>
              );
            })}
          </fieldset>
        )}
        {props.singleSupplementVnd > 0 && (
          <div>
            <Label htmlFor="booking-singleRooms">{t.singleRooms}</Label>
            <Input {...fields.aria("singleRooms")} type="number" min={0} max={people} value={party.singleRooms} onChange={set("singleRooms")} className="mt-1" />
            <span className="mt-1 block text-xs text-muted-foreground">{t.singleRoomsHint(formatVnd(props.singleSupplementVnd, locale))}</span>
            {fields.message("singleRooms")}
          </div>
        )}
      </div>
    </fieldset>
  );
}

/**
 * Discount code preview (D6): checked on the server for the preview, and again when the seats are held. The result
 * applies only while the field still holds the code that was checked.
 */
export function useDiscountPreview(preview: ((code: string, tourSlug: string, totalVnd: number) => Promise<Discount | null>) | undefined, tourSlug: string | undefined, q: Quote | null) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ checked: string; value: Discount | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const checked = result !== null && result.checked === code.trim().toUpperCase();
  const applied = checked ? result.value : null;
  const check = async () => {
    if (!preview || !tourSlug || !q || !code.trim()) return;
    setChecking(true);
    const value = await preview(code, tourSlug, q.totalVnd).catch(() => null);
    setResult({ checked: code.trim().toUpperCase(), value });
    setChecking(false);
  };
  return { enabled: Boolean(preview && tourSlug), code, setCode, checking, checked, applied, check, discounted: q ? applyDiscount(q, applied) : null };
}

export function DiscountField({ t, fields, discount }: { t: Content; fields: Fields; discount: ReturnType<typeof useDiscountPreview> }) {
  return (
    <div>
      <Label htmlFor="booking-discountCode">{t.discount.label}</Label>
      <div className="mt-1 flex gap-2">
        <Input {...fields.aria("discountCode")} value={discount.code} onChange={(e) => discount.setCode(e.target.value)} maxLength={30} autoComplete="off" className="max-w-48 uppercase" />
        <Button type="button" variant="outline" onClick={discount.check} disabled={discount.checking || !discount.code.trim()} data-testid="discount-apply">
          {t.discount.apply}
        </Button>
      </div>
      <p className="mt-1 text-sm" role="status" data-testid="discount-status">
        {discount.checked && (discount.applied ? <span className="text-success">{t.discount.ok}</span> : <span className="text-danger">{t.discount.bad}</span>)}
      </p>
      {fields.message("discountCode")}
    </div>
  );
}

/** Price lines of the chosen day: party, add-ons, single rooms, discount, total and deposit. */
export function QuoteSummary(props: { t: Content; locale: Locale; date: string; party: Party; childPercent: number; q: Quote; discounted: ReturnType<typeof applyDiscount> }) {
  const { t, locale, party, q, discounted: dq } = props;
  const money = (vnd: number) => formatVnd(vnd, locale);
  return (
    <div className="mt-3 grid gap-2 text-sm" data-testid="quote">
      <p className="font-medium capitalize">{formatDay(props.date, locale)}</p>
      <dl className="grid gap-2">
        <div className="flex justify-between">
          <dt>{t.adultLine(party.adults)}</dt>
          <dd>{money(party.adults * q.unitPriceVnd)}</dd>
        </div>
        {party.children > 0 && (
          <div className="flex justify-between">
            <dt>{t.childLine(party.children, props.childPercent)}</dt>
            <dd>{money(party.children * q.childPriceVnd)}</dd>
          </div>
        )}
        {party.infants > 0 && (
          <div className="flex justify-between">
            <dt>{t.infantLine(party.infants, q.infantPriceVnd === 0)}</dt>
            <dd>{money(party.infants * q.infantPriceVnd)}</dd>
          </div>
        )}
        {q.addons.map((a) => (
          <div key={a.id} className="flex justify-between" data-testid="addon-line">
            <dt>{t.addonLine(a.name[locale], a.qty)}</dt>
            <dd>{money(a.vnd)}</dd>
          </div>
        ))}
        {q.singleRooms > 0 && (
          <div className="flex justify-between">
            <dt>{t.singleLine(q.singleRooms)}</dt>
            <dd>{money(q.singleRooms * q.singleSupplementVnd)}</dd>
          </div>
        )}
        {dq.discountVnd > 0 && (
          <div className="flex justify-between text-success" data-testid="discount-line">
            <dt>{t.discount.line(dq.discountCode!)}</dt>
            <dd>−{money(dq.discountVnd)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 font-semibold">
          <dt>{t.total}</dt>
          <dd data-testid="total">{money(dq.totalVnd)}</dd>
        </div>
        <div className="flex justify-between text-base font-bold text-primary">
          <dt>{t.deposit}</dt>
          <dd data-testid="deposit">{money(dq.depositVnd)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        {t.rest}. {t.vndNote}
      </p>
    </div>
  );
}

/** Cancellation policy box and the terms checkbox. */
export function PolicyAndAgree({ t, locale, fields }: { t: Content; locale: Locale; fields: Fields }) {
  return (
    <>
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
          <input {...fields.aria("agree")} type="checkbox" required className="mt-0.5 size-4 shrink-0 accent-primary" />
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
        {fields.message("agree")}
      </div>
    </>
  );
}
