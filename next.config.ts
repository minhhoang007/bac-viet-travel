import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./core/security/headers";

const withNextIntl = createNextIntlPlugin("./core/i18n/request.ts");

// Browser uploads go straight to object storage (storage module), so its origin must be allowed by CSP.
// Read at build time: set STORAGE_ENDPOINT in the build environment too.
const storageOrigin = process.env.STORAGE_ENDPOINT ? new URL(process.env.STORAGE_ENDPOINT).origin : undefined;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ isDev: process.env.NODE_ENV !== "production", connectSrc: storageOrigin ? [storageOrigin] : [] }) }];
  },
};

export default withNextIntl(nextConfig);
