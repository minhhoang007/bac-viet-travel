import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./core/security/headers";
import { features } from "./config/features";

const withNextIntl = createNextIntlPlugin("./core/i18n/request.ts");

// Browser uploads go straight to object storage (storage module), so its origin must be allowed by CSP.
// Read at build time: set STORAGE_ENDPOINT in the build environment too.
const storageOrigin = process.env.STORAGE_ENDPOINT ? new URL(process.env.STORAGE_ENDPOINT).origin : undefined;
// Media module (ADR-0008): uploads go to Cloudinary's API, images load from its CDN.
const media = features.media ? { connect: ["https://api.cloudinary.com"], img: ["https://res.cloudinary.com"] } : { connect: [], img: [] };
// Cloudflare Turnstile on the sign-in form (optional): its script and challenge iframe.
const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? ["https://challenges.cloudflare.com"] : [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // E2E builds only (CI sets it on `pnpm build`): under `next start` an image variant can stop answering (the
  // optimizer dedupes requests for the same variant and one never settles), so the page never fires "load" and
  // tests time out at random. Vercel optimizes images itself; never set this for a real deployment.
  images: { unoptimized: process.env.E2E_UNOPTIMIZED_IMAGES === "1" },
  // Content read from disk at request time (dynamic product pages, blog…) must ship with the serverless
  // functions; Vercel only bundles files the code imports. Found on a real deployment (reuse finding G10).
  outputFileTracingIncludes: { "/**/*": ["./content/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ isDev: process.env.NODE_ENV !== "production", connectSrc: [...(storageOrigin ? [storageOrigin] : []), ...media.connect], imgSrc: media.img, scriptSrc: turnstile, frameSrc: turnstile }) }];
  },
};

export default withNextIntl(nextConfig);
