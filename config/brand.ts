// Project-owned.
import { brandDefaults } from "./brand.defaults";

/** Emerald / jade: the colour of Ha Long water and Sapa rice terraces. */
export const brand = {
  ...brandDefaults,
  logoText: "Bắc Việt Travel",
  colors: {
    light: {
      background: "#ffffff",
      foreground: "#0f1f1a",
      muted: "#f0f7f4",
      mutedForeground: "#4b5f58",
      border: "#dbe8e2",
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
