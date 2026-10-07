import { describe, expect, it } from "vitest";
import { bookingInputSchema } from "../validations";
import { addDays, isBookableDate, privateQuote, privateTier, quote, travellerKinds, vietnamDayStart, vietnamToday } from "../rules";

describe("booking rules", () => {
  it("prices children at 75% and the deposit at 30%, both rounded up to 1,000 VND", () => {
    expect(quote(1_890_000, { adults: 2, children: 1 })).toEqual({
      seats: 3,
      unitPriceVnd: 1_890_000,
      childPriceVnd: 1_418_000,
      infantPriceVnd: 0,
      singleSupplementVnd: 0,
      singleRooms: 0,
      addons: [],
      totalVnd: 5_198_000,
      depositVnd: 1_560_000,
    });
  });

  it("per-tour prices: child %, paid infants, single rooms only when the tour has a supplement", () => {
    const pricing = { childPercent: 50, infantVnd: 200_000, singleSupplementVnd: 900_000 };
    expect(quote(2_000_000, { adults: 2, children: 1, infants: 1, singleRooms: 1 }, pricing)).toEqual({
      seats: 3,
      unitPriceVnd: 2_000_000,
      childPriceVnd: 1_000_000,
      infantPriceVnd: 200_000,
      singleSupplementVnd: 900_000,
      singleRooms: 1,
      addons: [],
      totalVnd: 4_000_000 + 1_000_000 + 200_000 + 900_000,
      depositVnd: 1_830_000,
    });
    // No supplement on the tour: single rooms are ignored (the service refuses them).
    expect(quote(2_000_000, { adults: 1, children: 0, singleRooms: 1 }).totalVnd).toBe(2_000_000);
    // Infants are not seats.
    expect(quote(2_000_000, { adults: 1, children: 0, infants: 2 }, pricing).seats).toBe(1);
  });

  it("private tours: price per guest by group size (adults + children), children at 75%, limits enforced", () => {
    const pricing = { maxGuests: 8, tiers: [{ minGuests: 2, vnd: 3_000_000, usd: 120 }, { minGuests: 4, vnd: 2_000_000, usd: 80 }] };
    expect(privateTier(pricing, 1)).toBeNull();
    expect(privateTier(pricing, 3)?.vnd).toBe(3_000_000);
    expect(privateTier(pricing, 4)?.vnd).toBe(2_000_000);
    expect(privateTier(pricing, 9)).toBeNull();
    expect(privateQuote(pricing, { adults: 3, children: 1 })).toMatchObject({ seats: 4, unitPriceVnd: 2_000_000, childPriceVnd: 1_500_000, totalVnd: 7_500_000, depositVnd: 2_250_000 });
    expect(privateQuote(pricing, { adults: 1, children: 0 })).toBeNull();
  });

  it("uses Vietnam time for today and enforces the 2-day cutoff", () => {
    const lateEvening = new Date("2026-10-01T18:30:00Z"); // 01:30 on 2 Oct in Vietnam
    expect(vietnamToday(lateEvening)).toBe("2026-10-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isBookableDate("2026-10-03", lateEvening)).toBe(false);
    expect(isBookableDate("2026-10-04", lateEvening)).toBe(true);
  });

  it("starts a Vietnam day at 17:00 UTC the day before and lists traveller kinds in party order", () => {
    expect(vietnamDayStart("2026-10-02").toISOString()).toBe("2026-10-01T17:00:00.000Z");
    expect(vietnamToday(vietnamDayStart("2026-10-02"))).toBe("2026-10-02");
    expect(travellerKinds({ adults: 2, children: 1, infants: 1 })).toEqual(["adult", "adult", "child", "infant"]);
  });

  it("validates the guest form: party size limits and contact fields", () => {
    const base = { departureId: "0199a000-0000-7000-8000-000000000000", name: "Lan", email: "lan@example.com", phone: "0912 345 678", adults: "2", agree: "on" };
    expect(bookingInputSchema.parse(base)).toMatchObject({ adults: 2, children: 0, infants: 0, locale: "vi" });
    const tooMany = bookingInputSchema.safeParse({ ...base, adults: "6", children: "5" });
    expect(tooMany.error?.issues[0]).toMatchObject({ path: ["children"], message: "too_many" });
    const bad = bookingInputSchema.safeParse({ ...base, email: "x", phone: "abc", adults: "0" });
    expect(bad.error?.issues.map((i) => i.path[0]).sort()).toEqual(["adults", "email", "phone"]);
  });
});

describe("add-ons (B6)", () => {
  const addons = [
    { id: "pickup", name: { vi: "Đón khách sạn", en: "Hotel pick-up" }, vnd: 200_000, per: "booking" as const },
    { id: "bike", name: { vi: "Xe máy", en: "Motorbike" }, vnd: 150_000, per: "person" as const },
  ];
  it("per booking at most once, per person at most one per traveller (infants excluded), unknown ids ignored", () => {
    const q = quote(1_000_000, { adults: 2, children: 1, infants: 1, addons: { pickup: 3, bike: 9, nope: 1 } }, undefined, addons);
    expect(q.addons).toEqual([
      { id: "pickup", name: addons[0]!.name, qty: 1, vnd: 200_000 },
      { id: "bike", name: addons[1]!.name, qty: 3, vnd: 450_000 },
    ]);
    expect(q.totalVnd).toBe(2_000_000 + 750_000 + 650_000);
  });
});
