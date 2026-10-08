import { Barlow_Condensed, Be_Vietnam_Pro, Cormorant_Garamond, Noto_Serif_Display, Playfair_Display } from "next/font/google";
import type { ThemeName } from "../theme/themes";

// Self-hosted by next/font (no request to Google at runtime). All cover Vietnamese diacritics.
// Text font of every theme: preloaded.
const sans = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["300", "400", "500", "600"], variable: "--brand-font-sans", display: "swap" });

// Heading fonts, one per theme (Admin → Giao diện), none preloaded: the theme is chosen at runtime, and a preload of
// one theme's font would only compete with the hero photo on the others. A browser downloads a font only when the page
// uses it, so visitors get just the active theme's fonts (once per visit: pages then change in place).
// product/styles.css maps them per <html data-theme>. Default "Sơn Mài": a fine high-contrast serif.
const heading = Cormorant_Garamond({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--brand-font-heading", display: "swap", preload: false });
const playfair = Playfair_Display({ subsets: ["latin", "vietnamese"], style: ["normal", "italic"], variable: "--bv-font-playfair", display: "swap", preload: false });
const barlow = Barlow_Condensed({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600"], variable: "--bv-font-barlow", display: "swap", preload: false });
const notoDisplay = Noto_Serif_Display({ subsets: ["latin", "vietnamese"], style: ["normal", "italic"], variable: "--bv-font-noto-display", display: "swap", preload: false });

export const fontVariables = [sans, heading, playfair, barlow, notoDisplay].map((f) => f.variable).join(" ");

/** Heading font of each theme, for previews (the admin theme picker). */
export const THEME_HEADING_FONT: Record<ThemeName, string> = {
  lacquer: "var(--brand-font-heading)",
  paper: "var(--bv-font-playfair)",
  mist: "var(--brand-font-sans)",
  tomato: "var(--bv-font-barlow)",
  jade: "var(--bv-font-noto-display)",
};
