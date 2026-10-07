import type { BrandColors, ThemeColors } from "@/config/brand.defaults";
import { lacquer } from "@/config/brand";

/**
 * The five site themes an admin can pick (Admin → Giao diện, owner's request 2026-10-07). Each has a light and a dark
 * palette (both WCAG AA, see tests); the layout stays the same, only colors, fonts, corners and heading style change
 * (fonts and headings: product/styles.css per <html data-theme>). Pure: no database.
 */
export const THEME_NAMES = ["lacquer", "paper", "mist", "tomato", "jade"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** native: the theme's own scheme; auto: follows the visitor's system. */
export const THEME_MODES = ["native", "light", "dark", "auto"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export interface ThemeChoice {
  theme: ThemeName;
  mode: ThemeMode;
}

export const DEFAULT_THEME: ThemeChoice = { theme: "lacquer", mode: "native" };

/** Data-cache tag of the theme every page renders with: revalidating it regenerates the static pages. */
export const THEME_CACHE_TAG = "site-theme";

interface ThemeDef {
  native: "light" | "dark";
  light: ThemeColors;
  dark: ThemeColors;
  radius: string;
}

export const THEMES: Record<ThemeName, ThemeDef> = {
  // A · Sơn Mài: warm black, ivory, brass (config/brand.ts); the light version uses a deeper brass to stay readable.
  lacquer: {
    native: "dark",
    dark: lacquer,
    light: { background: "#f6f1e8", foreground: "#1a1714", muted: "#ece4d6", mutedForeground: "#5e554a", border: "#d9cfbf", primary: "#7d5f28", primaryForeground: "#ffffff" },
    radius: "0",
  },
  // B · Giấy Dó: paper and ink, moss green.
  paper: {
    native: "light",
    light: { background: "#f3eee4", foreground: "#1e1b16", muted: "#eae3d6", mutedForeground: "#5c554a", border: "#d6ccbb", primary: "#2e5b4e", primaryForeground: "#f3eee4" },
    dark: { background: "#191814", foreground: "#efe9dd", muted: "#22201b", mutedForeground: "#b5ad9f", border: "#36332c", primary: "#8cbfae", primaryForeground: "#191814" },
    radius: "0",
  },
  // C · Sương: mist grey-green, thin capitals, soft corners.
  mist: {
    native: "light",
    light: { background: "#eef0ec", foreground: "#2a2d2a", muted: "#e3e6e0", mutedForeground: "#596059", border: "#cfd4cc", primary: "#56654a", primaryForeground: "#eef0ec" },
    dark: { background: "#1a1d1b", foreground: "#e4e8e2", muted: "#232724", mutedForeground: "#a7aea6", border: "#353a36", primary: "#afc0a0", primaryForeground: "#1a1d1b" },
    radius: "0.75rem",
  },
  // D · Tạp chí: magazine black and white, condensed capitals, one magenta accent.
  tomato: {
    native: "light",
    light: { background: "#ffffff", foreground: "#2f2f2f", muted: "#f9f9f9", mutedForeground: "#52575c", border: "#e2e2e2", primary: "#d81b6a", primaryForeground: "#ffffff" },
    dark: { background: "#111111", foreground: "#f2f2f2", muted: "#1c1c1c", mutedForeground: "#ababab", border: "#2e2e2e", primary: "#ff6fa5", primaryForeground: "#111111" },
    radius: "0",
  },
  // E · Ngọc Vịnh: deep bay water, jade.
  jade: {
    native: "dark",
    dark: { background: "#0d1b1e", foreground: "#e6efee", muted: "#13262a", mutedForeground: "#9fb5b3", border: "#22383d", primary: "#7cc6b8", primaryForeground: "#0d1b1e" },
    light: { background: "#f3f7f6", foreground: "#0f2a2e", muted: "#e6eeec", mutedForeground: "#4a6266", border: "#cbd9d6", primary: "#1d6b62", primaryForeground: "#f3f7f6" },
    radius: "2px",
  },
};

export const isThemeName = (value: unknown): value is ThemeName => (THEME_NAMES as readonly unknown[]).includes(value);
export const isThemeMode = (value: unknown): value is ThemeMode => (THEME_MODES as readonly unknown[]).includes(value);

/** A stored or submitted value as a choice; anything unknown falls back to the default. */
export function parseThemeChoice(value: unknown): ThemeChoice {
  const v = (value ?? {}) as Partial<Record<keyof ThemeChoice, unknown>>;
  return { theme: isThemeName(v.theme) ? v.theme : DEFAULT_THEME.theme, mode: isThemeMode(v.mode) ? v.mode : DEFAULT_THEME.mode };
}

/** The colors the starter layout renders (themeCss) for a choice. */
export function themeColors(choice: ThemeChoice): BrandColors {
  const t = THEMES[choice.theme];
  const scheme = choice.mode === "native" ? t.native : choice.mode;
  if (scheme === "dark") return { light: t.dark, dark: t.dark, scheme: "dark", radius: t.radius };
  if (scheme === "light") return { light: t.light, scheme: "light", radius: t.radius };
  return { light: t.light, dark: t.dark, scheme: "auto", radius: t.radius };
}
