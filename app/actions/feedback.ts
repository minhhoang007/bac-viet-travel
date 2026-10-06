"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/bootstrap/container";
import { localePath } from "@/core/i18n/routing";

/** Post-trip feedback (E4): checked against the link signature; back to the page (thanks or the error). */
export async function submitFeedback(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "");
  const signature = String(formData.get("s") ?? "");
  const locale = formData.get("locale") === "en" ? "en" : "vi";
  let query = "";
  try {
    const app = getContainer().app;
    const result = app ? await app.product.feedback.submit(code, signature, Object.fromEntries(formData)) : { status: "not_found" as const };
    query = result.status === "saved" ? "&done=1" : result.status === "invalid" ? `&error=${result.field}` : "";
  } catch {
    query = "&error=server";
  }
  redirect(localePath(locale, `/feedback/${encodeURIComponent(code)}?s=${encodeURIComponent(signature)}${query}`));
}
