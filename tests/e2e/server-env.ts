// Project-owned: environment for the production server started by Playwright (`pnpm test:e2e`).
// The email module is on: the server needs these to start. Nothing is sent by these tests
// (successful submissions are covered by product/tours/tests/inquiry.test.ts with a fake mail port).
export const e2eServerEnv: Record<string, string> = {
  EMAIL_PROVIDER: "resend",
  EMAIL_API_KEY: "re_e2e_not_used",
  EMAIL_FROM: "booking@example.com",
  CONTACT_TO_EMAIL: "team@example.com",
};
