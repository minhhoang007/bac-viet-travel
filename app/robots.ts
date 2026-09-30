import type { MetadataRoute } from "next";
import { getEnv } from "@/bootstrap/env";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL;
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: new URL("/sitemap.xml", siteUrl).toString() };
}
