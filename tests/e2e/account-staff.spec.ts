// Project-owned E2E: staff accounts cannot be deleted from the account page (an admin removes them).
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";
import { signInStaff } from "./staff";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test("a staff member sees no delete form on the account page", async ({ page }) => {
  const email = `account-staff-${Date.now()}@bacviet.example`;
  await signInStaff(page, sql, email, "editor");
  await page.goto("/dashboard/account");
  await expect(page.getByTestId("delete-staff")).toBeVisible();
  await expect(page.locator("#confirm-email")).toHaveCount(0);
});
