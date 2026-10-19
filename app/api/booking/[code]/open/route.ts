import { redirect } from "next/navigation";
import { getBooking, guestBookingPath, rememberGuestToken } from "@/app/_lib/booking";

/**
 * First stop of a guest link that carries the secret (`?t=`, from emails or older links): the token goes into an
 * httpOnly cookie and the guest lands on the clean booking URL, so no page with the secret in its address is ever
 * rendered (ad and analytics tags send page URLs to Google/Meta).
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const locale = url.searchParams.get("locale") === "en" ? "en" : "vi";
  // Only a short status word comes back to the page (VNPay return), never a free-form URL.
  const pay = /^[a-z_]{1,30}$/.test(url.searchParams.get("pay") ?? "") ? url.searchParams.get("pay")! : undefined;
  // Only a token that opens the booking replaces the cookie: an old link (after a new one was sent) or a wrong one
  // must not lock out a guest whose cookie still works. The booking page answers 404 when neither works.
  if (token && (await getBooking().getForGuest(code, token))) await rememberGuestToken(code, token);
  redirect(guestBookingPath(locale, code, { voucher: url.searchParams.get("to") === "voucher", pay }));
}
