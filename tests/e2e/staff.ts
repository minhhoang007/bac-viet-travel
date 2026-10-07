// Project-owned E2E helper: sign a staff member in with the real magic-link flow (token read from the E2E database)
// and give them a role. Each sign-in uses its own client IP: the magic-link rate limit counts per IP.
import { expect, test, type Page } from "@playwright/test";
import type { Sql } from "postgres";

let n = 10;

export async function signInStaff(page: Page, sql: Sql, email: string, role: "editor" | "admin"): Promise<void> {
  // A different /24 per worker, so files running in parallel never share an address.
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `198.${51 + test.info().workerIndex}.100.${n++ % 250}` });
  await page.goto("/login");
  await page.fill("#login-email", email);
  await page.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  let token: string | undefined;
  for (let i = 0; i < 30 && !token; i++) {
    [{ identifier: token } = { identifier: undefined }] = await sql<{ identifier: string }[]>`
      select regexp_replace(identifier, '^magic-link:', '') as identifier from verifications where value like ${`%"${email}"%`} order by created_at desc limit 1`;
    if (!token) await new Promise((r) => setTimeout(r, 300));
  }
  await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=%2Fdashboard`);
  await expect(page).toHaveURL(/\/dashboard$/);
  await sql`update users set role = ${role} where email = ${email}`;
  // Staff need a second factor (starter v1.17): as if they had set up an authenticator app and passed it just now.
  // The real passkey/TOTP flows are covered by the starter's tests; admin.spec covers the gate and the step-up here.
  await withSecondFactor(sql, email);
}

/** An authenticator app on record (placeholder secret: never checked here) and the user's sessions past the 2FA. */
export async function withSecondFactor(sql: Sql, email: string): Promise<void> {
  const [user] = await sql<{ id: string }[]>`select id from users where email = ${email}`;
  await sql`insert into two_factors (user_id, secret, backup_codes, verified) select ${user!.id}, 'e2e', 'e2e', true where not exists (select 1 from two_factors where user_id = ${user!.id})`;
  await sql`update sessions set second_factor_at = now() where user_id = ${user!.id}`;
}
