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

  it("dark-only brand: dark palette whatever the system prefers, dark status colors, square corners", () => {
    const css = themeCss({ ...brandDefaults.colors, scheme: "dark", radius: "0" });
    expect(css).toContain(":root{color-scheme:dark;--background:#0b1120;");
    expect(css).toContain(":root:root{--danger:#f87171;--warning:#facc15;--success:#4ade80}");
    expect(css).toContain(":root:root{--radius:0}");
    expect(css).toContain("@media print{:root:root{color-scheme:light;--background:#ffffff;--foreground:#111111;");
    expect(css).not.toContain("prefers-color-scheme");
    expect(css).not.toContain("#ffffff");
  });

  it("light-only brand ignores the dark palette", () => {
    const css = themeCss({ ...brandDefaults.colors, scheme: "light" });
    expect(css).toMatch(/^:root\{color-scheme:light;--background:#ffffff;/);
    expect(css).not.toContain("#0b1120");
    expect(themeCss({ ...brandDefaults.colors, radius: "0.75rem" })).toContain(":root:root{--radius:0.75rem}");
  });

  it("rejects values that could inject CSS", () => {
    expect(() => themeCss({ ...brandDefaults.colors, radius: "0;}body{display:none" })).toThrow(/Invalid brand radius/);
    const evil = { light: { ...brandDefaults.colors.light, primary: "red;}body{display:none" } };
    expect(() => themeCss(evil)).toThrow(/Invalid brand color for "primary"/);
    const evil2 = { light: { ...brandDefaults.colors.light, border: "url(https://evil.example/x)" } };
    expect(() => themeCss(evil2)).toThrow(/Invalid brand color/);
  });
});
