"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/config/app";
import { getBookingContent } from "../booking/content";
import { DEFAULT_TOUR_PRICING, privateQuote, quote, type Discount, type PrivatePricing, type TourPricing } from "../booking/rules";
import type { Addon } from "../tours/model";
import {
  DepartureStep,
  DiscountField,
  fieldHelpers,
  PartyStep,
  PolicyAndAgree,
  PrivateDateStep,
  QuoteSummary,
  StepLegend,
  useDiscountPreview,
  type DepartureOption,
  type FormState,
  type Party,
} from "./booking-form-parts";

export type { DepartureOption };

/** Private mode: the guest picks any date in [minDate, maxDate] and the group size; price per person by tier. */
export interface PrivateTourOption {
  tourSlug: string;
  pricing: PrivatePricing;
  minDate: string;
  maxDate: string;
}

export interface BookingFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
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
  /** Add-ons the guest may choose (B6). */
  addons?: Addon[];
  /** Tour of the form and the discount preview (D6); without it no code field. */
  tourSlug?: string;
  previewDiscount?: (code: string, tourSlug: string, totalVnd: number) => Promise<Discount | null>;
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
  tourSlug,
  previewDiscount,
  addons = [],
}: BookingFormProps) {
  const t = getBookingContent(locale);
  const [state, formAction, pending] = useActionState(action, null);
  const fields = fieldHelpers(state, t);
  const [departureId, setDepartureId] = useState(
    departures.some((d) => d.id === initialDepartureId && d.bookable) ? initialDepartureId : departures.find((d) => d.bookable)?.id,
  );
  const [date, setDate] = useState(privateTour?.minDate ?? "");
  const [party, setParty] = useState<Party>({ adults: initialAdults ?? 2, children: 0, infants: 0, singleRooms: 0, addons: {} });
  // Prices and limits update only once React runs; tests wait for this marker before typing.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const group = departures.find((d) => d.id === departureId);
  // One shape for both modes: the chosen day, and the quote for it.
  const chosen = privateTour ? (date ? { date } : undefined) : group;
  const q = privateTour ? privateQuote(privateTour.pricing, party, pricing, addons) : group ? quote(group.unitPriceVnd, party, pricing, addons) : null;
  const guestsOutOfRange = Boolean(privateTour) && q === null;
  const discount = useDiscountPreview(previewDiscount, tourSlug, q);

  if (!privateTour && departures.length === 0) return <p className="rounded-md border border-border bg-muted p-4 text-sm">{t.noDepartures}</p>;

  return (
    <form action={formAction} className="relative grid gap-8 lg:grid-cols-[1fr_340px]" noValidate data-hydrated={hydrated || undefined}>
      <input type="hidden" name="locale" value={locale} />
      {privateTour ? <input type="hidden" name="tourSlug" value={privateTour.tourSlug} /> : <input type="hidden" name="departureId" value={departureId ?? ""} />}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-8">
        {privateTour ? (
          <PrivateDateStep
            t={t}
            locale={locale}
            fields={fields}
            pricing={privateTour.pricing}
            minDate={privateTour.minDate}
            maxDate={privateTour.maxDate}
            date={date}
            onDate={setDate}
            guests={q === null ? null : party.adults + party.children}
          />
        ) : (
          <DepartureStep t={t} locale={locale} fields={fields} departures={departures} departureId={departureId} onPick={setDepartureId} />
        )}

        <PartyStep
          t={t}
          locale={locale}
          fields={fields}
          party={party}
          onChange={setParty}
          maxAdults={privateTour?.pricing.maxGuests ?? 10}
          addons={addons}
          singleSupplementVnd={pricing.singleSupplementVnd}
        />

        <fieldset className="grid gap-4">
          <StepLegend n={3}>{t.formTitle}</StepLegend>
          <div>
            <Label htmlFor="booking-name">{t.name}</Label>
            <Input {...fields.aria("name")} autoComplete="name" className="mt-1" required />
            {fields.message("name")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="booking-email">{t.email}</Label>
              <Input {...fields.aria("email")} type="email" autoComplete="email" className="mt-1" required />
              {fields.message("email")}
            </div>
            <div>
              <Label htmlFor="booking-phone">{t.phone}</Label>
              <Input {...fields.aria("phone")} type="tel" autoComplete="tel" className="mt-1" required />
              {fields.message("phone")}
            </div>
          </div>
          {discount.enabled && <DiscountField t={t} fields={fields} discount={discount} />}
          <div>
            <Label htmlFor="booking-note">{t.note}</Label>
            <Textarea {...fields.aria("note")} rows={3} className="mt-1" />
            {fields.message("note")}
          </div>
        </fieldset>
      </div>

      <aside className="h-fit border border-border p-5 shadow-sm lg:sticky lg:top-6" aria-live="polite">
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
        <h2 className="font-heading font-normal">{t.summary}</h2>
        {chosen && q && discount.discounted && (
          <QuoteSummary t={t} locale={locale} date={chosen.date} party={party} childPercent={pricing.childPercent} q={q} discounted={discount.discounted} />
        )}
        <PolicyAndAgree t={t} locale={locale} fields={fields} />
        {guestsOutOfRange && privateTour && (
          <p className="mt-4 text-sm text-danger" data-testid="private-range">
            {t.privateRange(privateTour.pricing.tiers[0]!.minGuests, privateTour.pricing.maxGuests)}
          </p>
        )}
        {fields.formError && (
          <p role="alert" className="mt-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            {fields.formError}
          </p>
        )}
        <Button type="submit" className="mt-4 w-full" disabled={pending || !chosen || !q}>
          {pending ? t.sending : t.submit}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">{t.nextStep}</p>
      </aside>
    </form>
  );
}
