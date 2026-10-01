import { getDeposits } from "@/app/_lib/booking";
import { getEnv } from "@/bootstrap/env";

/** VNPay IPN for booking deposits (server-to-server, GET). Always HTTP 200 with the RspCode VNPay expects. */
export async function GET(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const env = getEnv();
  return Response.json(await getDeposits().handleIpn(params, { siteUrl: env.NEXT_PUBLIC_SITE_URL, teamEmail: env.extra.CONTACT_TO_EMAIL }));
}
