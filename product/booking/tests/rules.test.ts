import { describe, expect, it } from "vitest";
import { bookingInputSchema } from "../validations";
import { addDays, isBookableDate, quote, vietnamToday } from "../rules";

describe("booking rules", () => {
  it("prices children at 75% and the deposit at 30%, both rounded up to 1,000 VND", () => {
    expect(quote(1_890_000, { adults: 2, children: 1 })).toEqual({
      seats: 3,
      unitPriceVnd: 1_890_000,
      childPriceVnd: 1_418_000,
      totalVnd: 5_198_000,
      depositVnd: 1_560_000,
    });
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
