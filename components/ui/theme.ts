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

/** CSS variables for the theme, from config/brand.ts. Rendered once in the root layout. */
export function themeCss(colors: BrandColors): string {
  const light = `:root{${declarations(colors.light)}}`;
  return colors.dark ? `${light}@media (prefers-color-scheme: dark){:root{${declarations(colors.dark)}}}` : light;
}
