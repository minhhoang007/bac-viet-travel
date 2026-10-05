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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Content read from disk at request time (dynamic product pages, blog…) must ship with the serverless
  // functions; Vercel only bundles files the code imports. Found on a real deployment (reuse finding G10).
  outputFileTracingIncludes: { "/**/*": ["./content/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ isDev: process.env.NODE_ENV !== "production", connectSrc: [...(storageOrigin ? [storageOrigin] : []), ...media.connect], imgSrc: media.img }) }];
  },
};

export default withNextIntl(nextConfig);
