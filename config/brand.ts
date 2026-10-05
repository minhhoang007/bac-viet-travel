// Project-owned.
import { brandDefaults } from "./brand.defaults";

/**
 * Jade (Ha Long water, Sapa terraces) on warm paper, ink text; sand is a decoration-only accent (product/brand/logo.tsx).
 * Calm, premium style: few colours, lots of space.
 */
export const brand = {
  ...brandDefaults,
  logoText: "Bắc Việt Travel",
  colors: {
    light: {
      background: "#fbfaf7",
      foreground: "#0f1f1a",
      muted: "#f3f0e9",
      mutedForeground: "#56645f",
      border: "#e7e2d8",
      primary: "#0f766e",
      primaryForeground: "#ffffff",
    },
    dark: {
      background: "#0a1412",
      foreground: "#e3efe9",
      muted: "#13221e",
      mutedForeground: "#9db3ab",
      border: "#1d302a",
      primary: "#2dd4bf",
      primaryForeground: "#0a1412",
    },
  },
};
