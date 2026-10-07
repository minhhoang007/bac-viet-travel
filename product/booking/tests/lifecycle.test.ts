import { describe, expect, it } from "vitest";
import { awaitsDeposit, canBecome, canMove, isSold, LIFECYCLE, SOLD_STATUSES } from "../lifecycle";

describe("booking lifecycle", () => {
  it("sells seats only once the deposit is paid", () => {
    expect(SOLD_STATUSES).toEqual(["deposit_paid", "confirmed"]);
    expect(isSold("held")).toBe(false);
    expect(isSold("confirmed")).toBe(true);
  });

  it("allows only the moves the services make", () => {
    expect(canBecome("deposit_paid")).toEqual(["held", "expired"]);
    expect(canBecome("expired")).toEqual(["held"]);
    expect(canBecome("confirmed")).toEqual(["deposit_paid"]);
    expect(canBecome("cancelled")).toEqual(["held", "deposit_paid", "confirmed"]);
    expect(canBecome("refund_due")).toEqual(["held", "expired"]);
    expect(canBecome("held")).toEqual([]);
    expect(canMove("cancelled", "confirmed")).toBe(false);
    expect(awaitsDeposit("expired")).toBe(true);
    expect(awaitsDeposit("refund_due")).toBe(false);
  });

  it("ends in refund_due or cancelled, with no way back", () => {
    expect(LIFECYCLE.refund_due.next).toEqual([]);
    expect(LIFECYCLE.cancelled.next).toEqual([]);
  });
});
