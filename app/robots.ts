import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/bootstrap/env";

export default function robots(): MetadataRoute.Robots {
  const { NEXT_PUBLIC_SITE_URL: siteUrl, demoMode } = getPublicEnv();
  // A demo site must not show up in searches: visitors would try to buy from it.
  if (demoMode) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: new URL("/sitemap.xml", siteUrl).toString() };
}
