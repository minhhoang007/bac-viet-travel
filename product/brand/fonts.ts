import { Be_Vietnam_Pro, Cormorant_Garamond } from "next/font/google";

// Self-hosted by next/font (no request to Google at runtime). Both cover Vietnamese diacritics.
// "Sơn Mài" theme: a fine high-contrast serif for headings over a quiet sans for text.
const sans = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["300", "400", "500", "600"], variable: "--brand-font-sans", display: "swap" });
const heading = Cormorant_Garamond({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--brand-font-heading", display: "swap" });

export const fontVariables = `${sans.variable} ${heading.variable}`;
