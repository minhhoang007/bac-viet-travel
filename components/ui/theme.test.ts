import { describe, expect, it } from "vitest";
import { brandDefaults } from "@/config/brand.defaults";
import { themeCss } from "./theme";

describe("themeCss", () => {
  it("emits light and dark variables from config", () => {
    const css = themeCss(brandDefaults.colors);
    expect(css).toContain(":root{--background:#ffffff;");
    expect(css).toContain("--primary:#2563eb");
    expect(css).toContain("@media (prefers-color-scheme: dark){:root{--background:#0b1120;");
  });

  it("applies project overrides", () => {
    const colors = { light: { ...brandDefaults.colors.light, primary: "oklch(0.6 0.2 25)" } };
    const css = themeCss(colors);
    expect(css).toContain("--primary:oklch(0.6 0.2 25)");
    expect(css).not.toContain("prefers-color-scheme");
  });

  it("rejects values that could inject CSS", () => {
    const evil = { light: { ...brandDefaults.colors.light, primary: "red;}body{display:none" } };
    expect(() => themeCss(evil)).toThrow(/Invalid brand color for "primary"/);
    const evil2 = { light: { ...brandDefaults.colors.light, border: "url(https://evil.example/x)" } };
    expect(() => themeCss(evil2)).toThrow(/Invalid brand color/);
  });
});
