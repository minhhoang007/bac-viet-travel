/** First-party cookie holding the visitor's analytics choice ("granted" | "denied"). Read by the collect route. */
export const CONSENT_COOKIE = "analytics_consent";
export const CONSENT_MAX_AGE = 365 * 24 * 60 * 60;

export function hasConsent(cookieHeader: string | null): boolean {
  return (cookieHeader ?? "").split(/;\s*/).includes(`${CONSENT_COOKIE}=granted`);
}
