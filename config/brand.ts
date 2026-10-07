// Project-owned.
import { brandDefaults } from "./brand.defaults";

/**
 * "Sơn Mài" (lacquer): warm black ground, ivory text, a brass accent; square corners. Dark whatever the visitor's
 * system prefers (prints black on white). Chosen by the owner on 2026-10-07 from four design directions.
 * The default and fallback: admins can switch to another of the five themes (Admin → Giao diện, product/theme).
 */
export const lacquer = {
  background: "#12100e",
  foreground: "#f3ede3",
  muted: "#1b1815",
  mutedForeground: "#bdb2a2",
  border: "#2e2924",
  primary: "#c9a25e",
  primaryForeground: "#12100e",
};

export const brand = {
  ...brandDefaults,
  logoText: "Bắc Việt Travel",
  colors: { light: lacquer, dark: lacquer, scheme: "dark" as const, radius: "0" },
};
