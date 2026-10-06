import { SlidersHorizontal } from "lucide-react";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getProductContent } from "../content";
import { activeFilterCount, applyTourFilters, DURATIONS, PRICE_BANDS, SORTS, TOUR_TYPES, tourFilterQuery, type TourFilters } from "../tours/filters";
import { formatPrice } from "../tours/format";
import { DESTINATIONS, type Destination, type Tour } from "../tours/model";
import { TourCard } from "./tour-card";

const select = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm";

/**
 * Tour grid with a filter form (GET: the URL keeps the filters and can be shared). On a destination page
 * (`destination` set) the destination is fixed and the form posts back to that page.
 */
export function TourListing({ locale, tours, filters, destination }: { locale: Locale; tours: Tour[]; filters: TourFilters; destination?: Destination }) {
  const c = getProductContent(locale);
  const t = c.tours.filters;
  const f = destination ? { ...filters, destination } : filters;
  const results = applyTourFilters(tours, f, locale);
  const base = localePath(locale, destination ? `/tours/${destination}` : "/tours");
  const trip = { date: f.date, guests: f.guests };
  const tripLabel = t.trip(f.date, f.guests);
  const narrowing = activeFilterCount(destination ? { ...f, destination: undefined } : f);

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <form action={base} method="get" aria-label={t.title} data-testid="tour-filters" className="grid h-fit grid-cols-2 gap-3 rounded-2xl border border-border p-4 lg:sticky lg:top-24 lg:grid-cols-1">
        <p className="col-span-2 flex items-center gap-2 font-semibold lg:col-span-1">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {t.title}
        </p>
        {!destination && (
          <label className="grid gap-1 text-sm">
            {t.destination}
            <select name="destination" defaultValue={f.destination ?? ""} className={select}>
              <option value="">{t.any}</option>
              {DESTINATIONS.map((d) => (
                <option key={d} value={d}>
                  {c.destinations[d].name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-sm">
          {t.duration}
          <select name="duration" defaultValue={f.duration ?? ""} className={select}>
            <option value="">{t.any}</option>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {t.durations[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t.price}
          <select name="price" defaultValue={f.price ?? ""} className={select}>
            <option value="">{t.any}</option>
            {PRICE_BANDS.map((p) => (
              <option key={p} value={p}>
                {t.prices[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t.type}
          <select name="type" defaultValue={f.type ?? ""} className={select}>
            <option value="">{t.any}</option>
            {TOUR_TYPES.map((p) => (
              <option key={p} value={p}>
                {t.types[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t.sort}
          <select name="sort" defaultValue={f.sort} className={select}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t.sorts[s]}
              </option>
            ))}
          </select>
        </label>
        {f.date && <input type="hidden" name="date" value={f.date} />}
        {f.guests && <input type="hidden" name="guests" value={f.guests} />}
        <button type="submit" className="col-span-2 h-10 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 lg:col-span-1">
          {t.apply}
        </button>
        {narrowing > 0 && (
          <a href={`${base}${tourFilterQuery(trip)}`} className="col-span-2 text-center text-sm text-primary underline underline-offset-4 lg:col-span-1">
            {t.reset}
          </a>
        )}
      </form>

      <div>
        <h2 className="font-sans text-sm font-normal text-muted-foreground" aria-live="polite" data-testid="tour-count">
          {t.count(results.length)}
          {tripLabel && ` · ${tripLabel}`}
        </h2>
        {results.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">{t.empty}</p>
        ) : (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((tour, i) => (
              <div key={tour.slug} data-destination={tour.destination} className="contents">
                <TourCard
                  href={`${localePath(locale, `/tours/${tour.slug}`)}${tourFilterQuery({ ...trip, sort: "popular" })}`}
                  image={tour.images[0]!}
                  title={tour.title}
                  summary={tour.summary}
                  duration={c.tours.days(tour.days, tour.nights)}
                  destination={c.destinations[tour.destination].name}
                  price={formatPrice(tour, locale)}
                  fromLabel={c.tours.from}
                  perPersonLabel={c.tours.perPerson}
                  priority={i === 0}
                  // Grid beside the 16rem filter column: 3 columns from xl, 2 from sm.
                  sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 100vw"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
