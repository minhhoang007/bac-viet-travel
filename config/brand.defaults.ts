// Starter-owned. Projects override in config/brand.ts (ADR-0004).
// Colors are the single source of the theme: components/ui/theme.ts turns them into CSS variables.
export interface ThemeColors {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
}

export interface BrandColors {
  light: ThemeColors;
  /** Used with prefers-color-scheme: dark. Omit to keep the light palette in dark mode. */
  dark?: ThemeColors;
  /**
   * "auto" (default): light, or dark when the visitor's system prefers it. "dark" / "light": always that palette,
   * whatever the system says (a dark-only brand uses `dark`, or `light` when `dark` is omitted).
   */
  scheme?: "auto" | "light" | "dark";
  /** Corner radius of buttons, inputs and cards (CSS length, e.g. "0" for square corners). Default 0.5rem. */
  radius?: string;
}

const defaultColors: BrandColors = {
  light: {
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f1f5f9",
    mutedForeground: "#475569",
    border: "#e2e8f0",
    primary: "#2563eb",
    primaryForeground: "#ffffff",
  },
  dark: {
    background: "#0b1120",
    foreground: "#e2e8f0",
    muted: "#1e293b",
    mutedForeground: "#94a3b8",
    border: "#1e293b",
    primary: "#60a5fa",
    primaryForeground: "#0b1120",
  },
};

export const brandDefaults = {
  logoText: "Minh Starter",
  colors: defaultColors,
};
