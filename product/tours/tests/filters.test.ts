import { describe, expect, it } from "vitest";
import { getTourCatalog } from "../catalog";
import { activeFilterCount, applyTourFilters, parseTourFilters, tourFilterQuery } from "../filters";

const tours = getTourCatalog().list("vi");
const slugs = (list: { slug: string }[]) => list.map((t) => t.slug);

describe("tour list filters", () => {
  it("reads known values from the URL and ignores the rest", () => {
    expect(parseTourFilters({ destination: "sapa", duration: "2", price: "mid", type: "private", sort: "price-asc", date: "2026-11-02", guests: "3" })).toEqual({
      destination: "sapa",
      duration: "2",
      price: "mid",
      type: "private",
      sort: "price-asc",
      date: "2026-11-02",
      guests: 3,
    });
    expect(parseTourFilters({ destination: "paris", duration: "9", sort: "x", date: "tomorrow", guests: "-1", type: ["group", "private"] })).toEqual({ sort: "popular", type: "group" });
  });

  it("filters by destination, length, price band and private offer", () => {
    expect(applyTourFilters(tours, parseTourFilters({ destination: "ha-long" }), "vi").every((t) => t.destination === "ha-long")).toBe(true);
    expect(applyTourFilters(tours, parseTourFilters({ duration: "1" }), "vi").every((t) => t.days === 1)).toBe(true);
    expect(applyTourFilters(tours, parseTourFilters({ price: "low" }), "vi").every((t) => t.price.vnd < 1_500_000)).toBe(true);
    expect(applyTourFilters(tours, parseTourFilters({ price: "high" }), "en").every((t) => t.price.usd >= 120)).toBe(true);
    expect(applyTourFilters(tours, parseTourFilters({ type: "private" }), "vi").every((t) => t.private)).toBe(true);
    expect(applyTourFilters(tours, parseTourFilters({}), "vi")).toHaveLength(tours.length);
  });

  it("sorts by price and length; popular puts featured tours first", () => {
    const asc = applyTourFilters(tours, parseTourFilters({ sort: "price-asc" }), "vi");
    expect(asc.map((t) => t.price.vnd)).toEqual([...asc.map((t) => t.price.vnd)].sort((a, b) => a - b));
    const desc = applyTourFilters(tours, parseTourFilters({ sort: "price-desc" }), "vi").map((t) => t.price.vnd);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(slugs(asc)).toHaveLength(tours.length);
    const popular = applyTourFilters(tours, parseTourFilters({}), "vi");
    const firstPlain = popular.findIndex((t) => !t.featured);
    expect(popular.slice(firstPlain).some((t) => t.featured)).toBe(false);
    const byLength = applyTourFilters(tours, parseTourFilters({ sort: "duration" }), "vi").map((t) => t.days);
    expect(byLength).toEqual([...byLength].sort((a, b) => a - b));
  });

  it("builds share links without defaults and counts narrowing filters", () => {
    expect(tourFilterQuery({ destination: "sapa", sort: "popular", guests: 2 })).toBe("?destination=sapa&guests=2");
    expect(tourFilterQuery({ sort: "price-asc" })).toBe("?sort=price-asc");
    expect(tourFilterQuery({ sort: "popular" })).toBe("");
    expect(activeFilterCount(parseTourFilters({ destination: "sapa", price: "low", sort: "duration", guests: "2" }))).toBe(2);
  });
});
