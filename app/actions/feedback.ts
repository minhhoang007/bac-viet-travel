"use server";

import { redirect } from "next/navigation";
import { getFeedback } from "@/app/_lib/booking";
import { localePath } from "@/core/i18n/routing";

/** Post-trip feedback (E4): checked against the link signature; back to the page (thanks or the error). */
export async function submitFeedback(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "");
  const signature = String(formData.get("s") ?? "");
  const locale = formData.get("locale") === "en" ? "en" : "vi";
  let query = "";
  try {
    const result = (await getFeedback()?.submit(code, signature, Object.fromEntries(formData))) ?? { status: "not_found" as const };
    query = result.status === "saved" ? "&done=1" : result.status === "invalid" ? `&error=${result.field}` : "";
  } catch {
    query = "&error=server";
  }
  redirect(localePath(locale, `/feedback/${encodeURIComponent(code)}?s=${encodeURIComponent(signature)}${query}`));
}
