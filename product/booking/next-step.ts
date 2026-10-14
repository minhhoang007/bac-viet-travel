// What staff should do next with a booking, shown at the top of the admin booking page.
import type { Booking } from "../schema/booking";
import { balanceDue } from "./deposits";
import { refundLeft } from "./lifecycle";

export type NextStep =
  | { kind: "refund"; amountVnd: number }
  | { kind: "await_transfer"; until: Date }
  | { kind: "await_online"; until: Date }
  | { kind: "expired" }
  | { kind: "confirm" }
  | { kind: "collect_balance"; amountVnd: number }
  | { kind: "travellers"; missing: number }
  | { kind: "done" }
  | { kind: "cancelled" };

type NextStepBooking = Pick<
  Booking,
  "status" | "holdExpiresAt" | "totalVnd" | "depositVnd" | "balancePaidAt" | "refundDueVnd" | "refundedVnd" | "adults" | "children" | "infants" | "travellers"
>;

export function nextStep(b: NextStepBooking, { transferChosen }: { transferChosen: boolean }): NextStep {
  if (refundLeft(b) > 0) return { kind: "refund", amountVnd: refundLeft(b) };
  switch (b.status) {
    case "held":
      return transferChosen ? { kind: "await_transfer", until: b.holdExpiresAt } : { kind: "await_online", until: b.holdExpiresAt };
    case "expired":
      return { kind: "expired" };
    case "deposit_paid":
      return { kind: "confirm" };
    case "confirmed": {
      const balance = balanceDue(b);
      if (balance > 0) return { kind: "collect_balance", amountVnd: balance };
      const missing = b.adults + b.children + b.infants - b.travellers.length;
      return missing > 0 ? { kind: "travellers", missing } : { kind: "done" };
    }
    case "refund_due":
    case "cancelled":
      return { kind: "cancelled" };
  }
}
