import { getContainer } from "@/bootstrap/container";

/** VNPay IPN (server-to-server, GET). Always HTTP 200 with the RspCode VNPay expects; VNPay retries on non-00/02. */
export async function GET(request: Request): Promise<Response> {
  const { billing } = getContainer();
  if (!billing?.providers.includes("vnpay")) return new Response("Not found", { status: 404 });
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await billing.handleVnpayIpn(params));
}
