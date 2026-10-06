import { describe, expect, it } from "vitest";
import { bookingInputSchema } from "../validations";
import { addDays, isBookableDate, privateQuote, privateTier, quote, vietnamToday } from "../rules";

describe("booking rules", () => {
  it("prices children at 75% and the deposit at 30%, both rounded up to 1,000 VND", () => {
    expect(quote(1_890_000, { adults: 2, children: 1 })).toEqual({
      seats: 3,
      unitPriceVnd: 1_890_000,
      childPriceVnd: 1_418_000,
      infantPriceVnd: 0,
      singleSupplementVnd: 0,
      singleRooms: 0,
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

  it("validates the guest form: party size limits and contact fields", () => {
    const base = { departureId: "0199a000-0000-7000-8000-000000000000", name: "Lan", email: "lan@example.com", phone: "0912 345 678", adults: "2", agree: "on" };
    expect(bookingInputSchema.parse(base)).toMatchObject({ adults: 2, children: 0, infants: 0, locale: "vi" });
    const tooMany = bookingInputSchema.safeParse({ ...base, adults: "6", children: "5" });
    expect(tooMany.error?.issues[0]).toMatchObject({ path: ["children"], message: "too_many" });
    const bad = bookingInputSchema.safeParse({ ...base, email: "x", phone: "abc", adults: "0" });
    expect(bad.error?.issues.map((i) => i.path[0]).sort()).toEqual(["adults", "email", "phone"]);
  });
});
