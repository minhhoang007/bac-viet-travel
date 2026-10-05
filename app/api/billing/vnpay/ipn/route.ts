import { getContainer } from "@/bootstrap/container";

/**
 * VNPay IPN (server-to-server, GET). One URL per merchant code: billing orders and product orders (manifest
 * `vnpayIpn`) both arrive here. Always HTTP 200 with the RspCode VNPay expects; VNPay retries on non-00/02.
 */
export async function GET(request: Request): Promise<Response> {
  const { handleVnpayIpn } = getContainer();
  if (!handleVnpayIpn) return new Response("Not found", { status: 404 });
  return Response.json(await handleVnpayIpn(Object.fromEntries(new URL(request.url).searchParams)));
}
