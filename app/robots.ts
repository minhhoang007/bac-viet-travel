import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/bootstrap/env";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL;
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: new URL("/sitemap.xml", siteUrl).toString() };
}
