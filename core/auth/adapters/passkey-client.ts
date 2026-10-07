import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/client";

/**
 * Browser side of passkeys (WebAuthn needs the browser). The only client-side Better Auth code; everything else
 * goes through server actions. Each call resolves to true on success.
 */
const client = createAuthClient({ plugins: [passkeyClient()] });

/** Sign in, or pass the second factor for the current session (the server marks the new session). */
export async function passkeySignIn(): Promise<boolean> {
  const res = await client.signIn.passkey();
  return !res?.error;
}

/** Register a passkey for the signed-in user on this device. */
export async function passkeyRegister(name?: string): Promise<{ ok: true } | { ok: false; fresh: boolean }> {
  const res = await client.passkey.addPasskey(name ? { name } : {});
  if (!res?.error) return { ok: true };
  return { ok: false, fresh: res.error.status === 403 };
}

/** Whether this browser can use passkeys at all. */
export const passkeysSupported = () => typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
