import { ImageResponse } from "next/og";
import { getPublicEnv } from "@/bootstrap/env";
import { appConfig } from "@/config/app";
import { brand } from "@/config/brand";

const MAX_TITLE = 110;

/**
 * Open Graph image (1200×630) with the page title, in brand colors. Used by createMetadata for pages without
 * their own image (config/seo.ts `dynamicOgImage`). Title is length-limited; responses are cached by the CDN.
 */
export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("title") ?? appConfig.name;
  const title = raw.length > MAX_TITLE ? `${raw.slice(0, MAX_TITLE - 1)}…` : raw;
  const { primary, primaryForeground } = brand.colors.light;
  const site = new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL).host;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: primary, color: primaryForeground }}>
      <div style={{ fontSize: 34, opacity: 0.9 }}>{brand.logoText}</div>
      <div style={{ fontSize: title.length > 60 ? 56 : 72, lineHeight: 1.15, maxWidth: 1040 }}>{title}</div>
      <div style={{ fontSize: 28, opacity: 0.8 }}>{site}</div>
    </div>,
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=86400, s-maxage=31536000, immutable" } },
  );
}
