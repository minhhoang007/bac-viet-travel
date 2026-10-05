import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";

// Self-hosted by next/font (no request to Google at runtime). Both cover Vietnamese diacritics.
const sans = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--brand-font-sans", display: "swap" });
const heading = Playfair_Display({ subsets: ["latin", "vietnamese"], weight: ["500", "600"], variable: "--brand-font-heading", display: "swap" });

export const fontVariables = `${sans.variable} ${heading.variable}`;
