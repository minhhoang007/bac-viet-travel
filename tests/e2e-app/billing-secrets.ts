// Test-only billing credentials shared by playwright.app.config.ts (server env) and the specs (signing).
export const E2E_BILLING = {
  cronSecret: "e2e-cron-secret",
  // Standard Webhooks secret: whsec_ + base64 key (32 bytes).
  polarWebhookSecret: `whsec_${Buffer.from("e2e-polar-webhook-key-32-bytes!!").toString("base64")}`,
  polarProductMonthly: "prod_e2e_pro_month",
  vnpayTmnCode: "E2ETMN01",
  vnpayHashSecret: "E2EVNPAYHASHSECRETE2EVNPAYHASH01",
};
