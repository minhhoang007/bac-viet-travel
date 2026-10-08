import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Generated share images (/api/og) draw only titles the site signed: anyone could otherwise make an image with the
 * brand and any text on the site's own domain. Server-only (node:crypto).
 */
export const ogSignature = (secret: string, title: string) => createHmac("sha256", secret).update(`og-title:${title}`).digest("base64url").slice(0, 22);

/** Path of the share image for a page title: signed when a secret is set, otherwise the generic brand image. */
export function ogImagePath(title: string, secret: string | undefined): string {
  return secret ? `/api/og?title=${encodeURIComponent(title)}&s=${ogSignature(secret, title)}` : "/api/og";
}

/** The title to draw: only when its signature is right (otherwise null: the generic image). */
export function verifiedOgTitle(title: string | null, signature: string | null, secret: string | undefined): string | null {
  if (!title || !signature || !secret) return null;
  const expected = Buffer.from(ogSignature(secret, title));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given) ? title : null;
}
