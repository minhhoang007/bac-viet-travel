import type { BrandColors, ThemeColors } from "@/config/brand.defaults";

const TOKENS: Record<keyof ThemeColors, string> = {
  background: "--background",
  foreground: "--foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  border: "--border",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
};

// Hex or a single color function with plain numeric arguments — nothing that can close the rule or inject CSS.
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([0-9.,%\s/+-]+\))$/i;

function declarations(colors: ThemeColors): string {
  return (Object.keys(TOKENS) as (keyof ThemeColors)[])
    .map((key) => {
      const value = colors[key].trim();
      if (!COLOR.test(value)) throw new Error(`Invalid brand color for "${key}": ${JSON.stringify(value)}`);
      return `${TOKENS[key]}:${value}`;
    })
    .join(";");
}

// Status colors readable on a dark background (app/globals.css uses them under prefers-color-scheme: dark).
const DARK_STATUS = "--danger:#f87171;--warning:#facc15;--success:#4ade80";
const LENGTH = /^(0|\d+(\.\d+)?(px|rem|em))$/;

/**
 * CSS variables for the theme, from config/brand.ts. Rendered once in the root layout. Overrides of globals.css
 * tokens use `:root:root` so they win whatever order the stylesheets load in.
 */
export function themeCss(colors: BrandColors): string {
  const scheme = colors.scheme ?? "auto";
  let css: string;
  if (scheme === "dark") css = `:root{color-scheme:dark;${declarations(colors.dark ?? colors.light)}}:root:root{${DARK_STATUS}}`;
  else if (scheme === "light") css = `:root{color-scheme:light;${declarations(colors.light)}}`;
  else {
    const light = `:root{${declarations(colors.light)}}`;
    css = colors.dark ? `${light}@media (prefers-color-scheme: dark){:root{${declarations(colors.dark)}}}` : light;
  }
  if (colors.radius !== undefined) {
    if (!LENGTH.test(colors.radius.trim())) throw new Error(`Invalid brand radius: ${JSON.stringify(colors.radius)}`);
    css += `:root:root{--radius:${colors.radius.trim()}}`;
  }
  return css;
}

/** Toasts follow the same scheme as the theme. */
export const toastTheme = (colors: BrandColors) => (colors.scheme === "dark" ? "dark" : colors.scheme === "light" ? "light" : "system");
