/**
 * One-time payment port (VNPay today). Used by the billing module (plan purchases) and by product code
 * (e.g. booking deposits) through `ProductContext.payments`.
 */
export interface OneTimePaymentProvider {
  buildPaymentUrl(input: {
    txnRef: string;
    /** Amount in the currency's main unit (VND). */
    amount: number;
    orderInfo: string;
    ipAddr: string;
    returnUrl: string;
    locale: "vi" | "en";
    createdAt: Date;
    expiresAt: Date;
  }): string;
  /** Verifies the provider signature on callback params (IPN / return URL). */
  verify(params: Record<string, string>): boolean;
  /**
   * Asks the provider for the transaction's state (VNPay querydr), for when the IPN never arrived. `createdAt` is the
   * value given to buildPaymentUrl. "paid" carries IPN-shaped params for the IPN handler. Throws on provider errors.
   */
  query(input: { txnRef: string; createdAt: Date }): Promise<PaymentQueryResult>;
}

export type PaymentQueryResult = { status: "paid"; params: Record<string, string> } | { status: "unpaid" } | { status: "not_found" };

export interface Payments {
  /** Present when VNPAY_TMN_CODE and VNPAY_HASH_SECRET are set. `sandbox`: no real money moves. */
  vnpay?: OneTimePaymentProvider & { sandbox: boolean };
}
