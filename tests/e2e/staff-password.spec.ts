// Staff password sign-in (owner's choice 2026-10-19): an admin invites by email, the new hire sets a password from the
// emailed link, signs in with it and is then asked for two-step verification before the admin area.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { e2eServerEnv } from "./server-env";
import { signInStaff } from "./staff";

const sql = postgres(e2eServerEnv.DATABASE_URL!, { max: 1, onnotice: () => {} });
test.afterAll(() => sql.end());

test("invited staff set a password from the emailed link, sign in with it, then add two-step verification", async ({ page, browser }) => {
  test.setTimeout(90_000); // two people, five pages, a breach check over the network
  const email = `new-hire-${Date.now()}@bacviet.example`;
  // Random: new passwords are checked against known breaches.
  const password = `bac viet ${crypto.randomUUID()}`;

  // Its own admin address per run: sign-in emails are limited per address.
  await signInStaff(page, sql, `invite-admin-${Date.now()}@bacviet.example`, "admin");
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin/staff");
  const form = page.getByTestId("staff-form");
  await form.getByLabel("Email nhân viên").fill(email);
  await form.getByLabel("Vai trò").selectOption("sale");
  await form.getByRole("button", { name: "Thêm / đổi vai trò" }).click();
  // The E2E server has no working mail provider: the link is read from the database whether or not it went out.
  await expect(page.getByRole("status")).toContainText(/Đã tạo tài khoản|chưa gửi được email/);
  await expect(page.locator(`[data-staff="${email}"]`)).toContainText("Sale");
  const [row] = await sql<{ token: string }[]>`
    select replace(v.identifier, 'reset-password:', '') as token from verifications v join users u on u.id::text = v.value
    where u.email = ${email} and v.identifier like 'reset-password:%' order by v.created_at desc limit 1`;
  expect(row?.token).toBeTruthy();

  const hire = await (await browser.newContext()).newPage();
  await hire.goto(`/login/reset?token=${row!.token}`);
  const newPassword = hire.getByTestId("password-new");
  await newPassword.getByLabel("Mật khẩu mới", { exact: true }).fill(password);
  await newPassword.getByLabel("Nhập lại mật khẩu mới").fill(`${password}x`);
  await newPassword.getByRole("button", { name: "Lưu mật khẩu" }).click();
  await expect(newPassword.getByRole("alert")).toHaveText("Hai mật khẩu không giống nhau.");
  await newPassword.getByLabel("Mật khẩu mới", { exact: true }).fill(password);
  await newPassword.getByLabel("Nhập lại mật khẩu mới").fill(password);
  await newPassword.getByRole("button", { name: "Lưu mật khẩu" }).click();
  // Saving checks the password against known breaches (a network call) and hashes it: slower than a page.
  await expect(hire).toHaveURL(/\/login\?reset=done$/, { timeout: 20_000 });
  await expect(hire.getByText("Đã đặt mật khẩu mới. Hãy đăng nhập.")).toBeVisible();

  const signIn = hire.getByTestId("password-sign-in");
  await signIn.getByLabel("Email").fill(email);
  await signIn.getByLabel("Mật khẩu", { exact: true }).fill("not the right password");
  await signIn.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(signIn.getByRole("alert")).toHaveText("Email hoặc mật khẩu không đúng.");
  await expect(signIn.getByLabel("Email")).toHaveValue(email);
  await signIn.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await signIn.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(hire).toHaveURL(/\/dashboard$/);

  // Staff still need a second factor: the admin area sends them to set one up; the password shows as set.
  await hire.goto("/admin/bookings");
  await expect(hire).toHaveURL(/\/security\?setup=1$/);
  await expect(hire.getByTestId("security-password")).toContainText("Đã đặt");
  const axe = await new AxeBuilder({ page: hire }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("forgot password: the same answer for any address, and the login page links to it", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("password-sign-in").getByRole("link", { name: "Quên mật khẩu?" }).click();
  await expect(page).toHaveURL(/\/login\/reset$/);
  const form = page.getByTestId("password-reset-request");
  await form.getByLabel("Email").fill("someone-unknown@bacviet.example");
  await form.getByRole("button", { name: "Gửi liên kết" }).click();
  await expect(page.getByRole("status")).toContainText("Nếu email này là tài khoản nhân viên");
  // A used or made-up link says so when saving.
  await page.goto("/login/reset?token=made-up-token");
  const set = page.getByTestId("password-new");
  await set.getByLabel("Mật khẩu mới", { exact: true }).fill("a long enough password here");
  await set.getByLabel("Nhập lại mật khẩu mới").fill("a long enough password here");
  await set.getByRole("button", { name: "Lưu mật khẩu" }).click();
  await expect(set.getByRole("alert")).toContainText("Liên kết đã dùng hoặc đã hết hạn");
});
