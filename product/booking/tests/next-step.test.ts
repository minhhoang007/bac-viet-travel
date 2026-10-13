import { describe, expect, it } from "vitest";
import { formatShortTime } from "../content";
import { nextStep } from "../next-step";

const until = new Date("2026-10-16T03:00:00Z");
const base = {
  status: "held" as const,
  holdExpiresAt: until,
  totalVnd: 2_380_000,
  depositVnd: 714_000,
  balancePaidAt: null,
  refundDueVnd: 0,
  refundedAt: null,
  adults: 2,
  children: 0,
  infants: 0,
  travellers: [],
};
const named = [{ name: "A", birthYear: 1990 }, { name: "B", birthYear: 1991 }];

describe("nextStep", () => {
  it("a hold waits for the transfer the guest chose, or for VNPay, until the hold ends", () => {
    expect(nextStep(base, { transferChosen: true })).toEqual({ kind: "await_transfer", until });
    expect(nextStep(base, { transferChosen: false })).toEqual({ kind: "await_online", until });
  });

  it("a paid deposit asks staff to confirm, then to collect the balance", () => {
    expect(nextStep({ ...base, status: "deposit_paid" }, { transferChosen: false })).toEqual({ kind: "confirm" });
    expect(nextStep({ ...base, status: "confirmed" }, { transferChosen: false })).toEqual({ kind: "collect_balance", amountVnd: 1_666_000 });
  });

  it("paid in full: names still missing, then nothing to do", () => {
    const paid = { ...base, status: "confirmed" as const, balancePaidAt: until };
    expect(nextStep(paid, { transferChosen: false })).toEqual({ kind: "travellers", missing: 2 });
    expect(nextStep({ ...paid, travellers: named }, { transferChosen: false })).toEqual({ kind: "done" });
  });

  it("money owed back comes first, whatever the status", () => {
    expect(nextStep({ ...base, status: "cancelled", refundDueVnd: 714_000 }, { transferChosen: false })).toEqual({ kind: "refund", amountVnd: 714_000 });
    expect(nextStep({ ...base, status: "refund_due", refundDueVnd: 714_000, refundedAt: until }, { transferChosen: false })).toEqual({ kind: "cancelled" });
  });

  it("hold deadlines read as Vietnam time, day/month", () => {
    expect(formatShortTime(new Date("2026-10-15T18:57:00Z"))).toBe("01:57, 16/10");
  });

  it("an expired hold needs nothing unless money arrives", () => {
    expect(nextStep({ ...base, status: "expired" }, { transferChosen: true })).toEqual({ kind: "expired" });
  });
});
