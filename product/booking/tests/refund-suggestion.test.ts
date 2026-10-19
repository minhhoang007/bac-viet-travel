import { describe, expect, it } from "vitest";
import { suggestedRefundVnd } from "../../policies";

describe("suggested refund on cancellation", () => {
  it("is the policy share of the deposit, rounded up to 1 000, plus any balance paid; never above what was paid", () => {
    expect(suggestedRefundVnd({ depositVnd: 371_000, paidVnd: 371_000 }, 10)).toBe(371_000); // 100%
    expect(suggestedRefundVnd({ depositVnd: 371_000, paidVnd: 371_000 }, 4)).toBe(186_000); // 50% of 371,000 = 185,500 → 186,000
    expect(suggestedRefundVnd({ depositVnd: 371_000, paidVnd: 371_000 }, 1)).toBe(0);
    // Balance already paid goes back in full; an odd OTA total stays reachable.
    expect(suggestedRefundVnd({ depositVnd: 370_371, paidVnd: 1_234_567 }, 10)).toBe(1_234_567);
    expect(suggestedRefundVnd({ depositVnd: 370_371, paidVnd: 1_234_567 }, 4)).toBe(186_000 + 1_234_567 - 370_371);
  });
});
