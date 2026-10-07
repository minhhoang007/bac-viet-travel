// Project-owned E2E helper: the guest part of the booking form (details, terms, "hold") shared by the booking specs.
import type { Page } from "@playwright/test";

export async function submitHold(page: Page, guest: { name: string; email: string; phone: string }): Promise<void> {
  await page.getByLabel("Họ tên").fill(guest.name);
  await page.getByLabel("Email").fill(guest.email);
  await page.getByLabel("Số điện thoại / WhatsApp").fill(guest.phone);
  await page.getByRole("checkbox", { name: /Tôi đồng ý/ }).check();
  await page.getByRole("button", { name: "Giữ chỗ 15 phút" }).click();
}
