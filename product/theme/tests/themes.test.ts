import { describe, expect, it } from "vitest";
import type { ThemeColors } from "@/config/brand.defaults";
import { brand } from "@/config/brand";
import { themeCss } from "@/components/ui/theme";
import { DEFAULT_THEME, parseThemeChoice, THEME_MODES, THEME_NAMES, THEMES, themeColors } from "../themes";

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("site themes", () => {
  const palettes = THEME_NAMES.flatMap((name) => (["light", "dark"] as const).map((scheme) => [`${name}.${scheme}`, THEMES[name][scheme]] as [string, ThemeColors]));

  it.each(palettes)("%s: text, muted text, links and buttons pass WCAG AA (4.5:1)", (_, p) => {
    const pairs: [string, string, string][] = [
      ["foreground/background", p.foreground, p.background],
      ["foreground/muted", p.foreground, p.muted],
      ["mutedForeground/background", p.mutedForeground, p.background],
      ["mutedForeground/muted", p.mutedForeground, p.muted],
      ["primary/background", p.primary, p.background],
      ["primary/muted", p.primary, p.muted],
      ["primaryForeground/primary", p.primaryForeground, p.primary],
    ];
    for (const [pair, a, b] of pairs) expect(contrast(a, b), pair).toBeGreaterThanOrEqual(4.5);
  });

  it("the default theme is the configured brand (Sơn Mài, dark)", () => {
    expect(themeColors(DEFAULT_THEME)).toEqual(brand.colors);
  });

  it("modes: the theme's own scheme, always light, always dark, or the visitor's", () => {
    expect(themeColors({ theme: "paper", mode: "native" })).toMatchObject({ scheme: "light", light: THEMES.paper.light });
    expect(themeColors({ theme: "paper", mode: "dark" })).toMatchObject({ scheme: "dark", light: THEMES.paper.dark, dark: THEMES.paper.dark });
    expect(themeColors({ theme: "lacquer", mode: "light" })).toMatchObject({ scheme: "light", light: THEMES.lacquer.light });
    expect(themeColors({ theme: "jade", mode: "auto" })).toMatchObject({ scheme: "auto", light: THEMES.jade.light, dark: THEMES.jade.dark });
  });

  it("every theme and mode renders valid CSS", () => {
    for (const theme of THEME_NAMES) for (const mode of THEME_MODES) expect(() => themeCss(themeColors({ theme, mode }))).not.toThrow();
  });

  it("an unknown stored value falls back to the default", () => {
    expect(parseThemeChoice(null)).toEqual(DEFAULT_THEME);
    expect(parseThemeChoice({ theme: "neon", mode: "dark" })).toEqual({ theme: "lacquer", mode: "dark" });
    expect(parseThemeChoice({ theme: "mist", mode: "sepia" })).toEqual({ theme: "mist", mode: "native" });
  });
});
