import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Default favicon: the first letter of the brand on its primary color (config/brand.ts). A project with its own
 * icon adds `app/favicon.ico` (project-owned); browsers then pick it up as well.
 */
export default function Icon() {
  const { primary, primaryForeground } = brand.colors.light;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, background: primary, color: primaryForeground, fontSize: 22, fontWeight: 700 }}>
      {brand.logoText.trim().charAt(0).toUpperCase() || "•"}
    </div>,
    size,
  );
}
