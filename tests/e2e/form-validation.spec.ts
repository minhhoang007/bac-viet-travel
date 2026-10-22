// Project-owned E2E: the common bad input on every public form (checklist: .claude/skills/form-input-checks).
// Forms post with noValidate, so these submissions reach the server as a script would: the server alone refuses them
// (spaces around an email are dropped by the browser for type="email"; the server trims too, see schema tests).
// Nothing here succeeds (no hold, no email): validation runs before rate limits, so other files' limits are untouched.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function seriousA11y(page: Page, label: string): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${label}: ${v.id}`);
}

/** The field shows `message` under it and is marked invalid for screen readers. */
async function expectFieldError(field: Locator, message: string) {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  const describedBy = await field.getAttribute("aria-describedby");
  expect(describedBy, "error message linked with aria-describedby").toBeTruthy();
  await expect(field.page().locator(`[id="${describedBy}"]`)).toHaveText(message);
}

test("sign in: empty fields say so under each field; a wrong email keeps what was typed", async ({ page }) => {
  await page.goto("/login");
  const password = page.getByTestId("password-sign-in");
  await password.getByRole("button", { name: "Đăng nhập" }).click();
  await expectFieldError(password.getByLabel("Email"), "Vui lòng nhập thông tin này.");
  await expectFieldError(password.getByLabel("Mật khẩu", { exact: true }), "Vui lòng nhập thông tin này.");
  await expect(password.getByRole("alert")).toHaveCount(0); // not "wrong email or password"

  // Only the password missing: the email stays, and only the password is marked.
  await password.getByLabel("Email").fill("staff@bacviet.example");
  await password.getByRole("button", { name: "Đăng nhập" }).click();
  await expectFieldError(password.getByLabel("Mật khẩu", { exact: true }), "Vui lòng nhập thông tin này.");
  await expect(password.getByLabel("Email")).not.toHaveAttribute("aria-invalid", "true");
  await expect(password.getByLabel("Email")).toHaveValue("staff@bacviet.example");

  const link = page.locator("form").filter({ has: page.getByRole("button", { name: "Gửi liên kết đăng nhập" }) });
  await link.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  await expectFieldError(link.getByLabel("Email"), "Vui lòng nhập email.");
  await link.getByLabel("Email").fill("not-an-email");
  await link.getByRole("button", { name: "Gửi liên kết đăng nhập" }).click();
  await expectFieldError(link.getByLabel("Email"), "Email không hợp lệ.");
  await expect(link.getByLabel("Email")).toHaveValue("not-an-email");

  expect(await seriousA11y(page, "/login with errors")).toEqual([]);
});

test("forgot password: empty and wrong email under the field, the typed email is kept", async ({ page }) => {
  await page.goto("/login/reset");
  const form = page.getByTestId("password-reset-request");
  await form.getByRole("button", { name: "Gửi liên kết" }).click();
  await expectFieldError(form.getByLabel("Email"), "Vui lòng nhập email.");
  await form.getByLabel("Email").fill("staff@bacviet");
  await form.getByRole("button", { name: "Gửi liên kết" }).click();
  await expectFieldError(form.getByLabel("Email"), "Email không hợp lệ.");
  await expect(form.getByLabel("Email")).toHaveValue("staff@bacviet");
  expect(await seriousA11y(page, "/login/reset with errors")).toEqual([]);
});

test("contact form: empty and spaces-only fields are required, a wrong email is named, typed text is kept", async ({ page }) => {
  await page.goto("/contact");
  const form = page.locator("main form");
  await form.getByRole("button", { name: "Gửi" }).click();
  for (const label of ["Họ tên", "Email", "Nội dung"]) await expectFieldError(form.getByLabel(label), "Vui lòng nhập trường này.");

  await form.getByLabel("Họ tên").fill("Nguyễn Văn Ánh 🌄");
  await form.getByLabel("Email").fill("a@");
  await form.getByLabel("Nội dung").fill("    ");
  await form.getByRole("button", { name: "Gửi" }).click();
  await expectFieldError(form.getByLabel("Email"), "Email không hợp lệ.");
  await expectFieldError(form.getByLabel("Nội dung"), "Vui lòng nhập trường này.");
  await expect(form.getByLabel("Họ tên")).toHaveValue("Nguyễn Văn Ánh 🌄");
  await expect(form.getByLabel("Họ tên")).not.toHaveAttribute("aria-invalid", "true");
  expect(await seriousA11y(page, "/contact with errors")).toEqual([]);
});

test("tour inquiry: empty name, a phone without digits; everything typed is kept", async ({ page }) => {
  await page.goto("/tours/sapa-trekking-2d1n");
  await page.getByTestId("inquiry").getByText("Hỏi tư vấn trước khi đặt").click();
  const form = page.locator("#ask form");
  await form.getByLabel("Email", { exact: true }).and(form.locator("input[type=email]")).fill("khach@example.com");
  await form.getByLabel("Số điện thoại / WhatsApp").fill("--------");
  await form.getByLabel(/Ghi chú/).fill("Ăn chay, đón ở phố cổ");
  await form.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(form.getByText("Vui lòng nhập thông tin này.").first()).toBeVisible(); // name
  await expect(form.getByText("Số điện thoại không hợp lệ.")).toBeVisible();
  await expect(form.getByText("Email không hợp lệ.")).toHaveCount(0);
  // Everything typed survives the error (React would otherwise reset the form).
  await expect(form.getByLabel("Số điện thoại / WhatsApp")).toHaveValue("--------");
  await expect(form.getByLabel(/Ghi chú/)).toHaveValue("Ăn chay, đón ở phố cổ");
  await expect(form.getByLabel("Email", { exact: true }).and(form.locator("input[type=email]"))).toHaveValue("khach@example.com");
});

test("booking form: empty name, spaces-only email, a phone without digits, terms not accepted; nothing is held", async ({ page }) => {
  await page.goto("/tours/ninh-binh-day-tour/book");
  await expect(page.locator("form[data-hydrated]")).toBeVisible();
  await page.getByLabel("Họ tên").fill("");
  await page.getByLabel("Email").fill("   ");
  await page.getByLabel("Số điện thoại / WhatsApp").fill("((((((((");
  await page.getByRole("checkbox", { name: /Tôi đồng ý/ }).setChecked(false);
  await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();

  await expect(page.getByLabel("Họ tên")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Họ tên")).toBeFocused(); // the first wrong field
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Số điện thoại / WhatsApp")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Số điện thoại / WhatsApp")).toHaveValue("((((((((");
  await expect(page).toHaveURL(/\/book$/); // still on the form: no booking page
  expect(await seriousA11y(page, "booking form with errors")).toEqual([]);
});

test("junk URL parameters and unknown codes never answer 5xx", async ({ request }) => {
  const cases: [path: string, expected: number | "<500"][] = [
    ["/api/tours/availability?date=2027-13-45&guests=2", 400],
    ["/api/tours/availability?date=2027-02-31&guests=2", 400],
    ["/api/tours/availability?date=tomorrow&guests=abc", 400],
    ["/tours?date=2027-13-45&guests=2", "<500"],
    ["/tours?guests=-5&price=abc&date%5B%5D=1&sort=%3Cscript%3E", "<500"],
    ["/en/tours?guests=abc&destination=paris", "<500"],
    ["/blog?page=-1", "<500"],
    ["/blog?page=abc", "<500"],
    ["/tours/ninh-binh-day-tour/book?date=2027-02-31&adults=-1", "<500"],
    ["/tours/khong-ton-tai", 404],
    ["/booking/XXXX", 404],
    ["/booking/'%3Cscript%3E", 404],
    ["/booking/abc/voucher", "<500"],
    ["/feedback/ABC?s=zzz", "<500"],
    ["/api/booking/abc/open", "<500"],
  ];
  const wrong: string[] = [];
  for (const [path, expected] of cases) {
    const status = (await request.get(path, { maxRedirects: 0 })).status();
    if (expected === "<500" ? status >= 500 : status !== expected) wrong.push(`${path}: ${status}`);
  }
  expect(wrong).toEqual([]);
});
