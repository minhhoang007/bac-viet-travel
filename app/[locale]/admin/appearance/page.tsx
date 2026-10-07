import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/app/_lib/admin";
import { saveTheme } from "@/app/actions/theme";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/app";
import { localePath } from "@/core/i18n/routing";
import { getThemeContent } from "@/product/theme/content";
import { THEME_HEADING_FONT } from "@/product/brand/fonts";
import { THEME_MODES, THEME_NAMES, THEMES } from "@/product/theme/themes";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getThemeContent((await params).locale).title };
}

/** Site theme (owner's request 2026-10-07): admins pick one of five styles and the light/dark mode. */
export default async function AppearancePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { container } = await requireAdmin();
  const c = getThemeContent(locale);
  const current = await container.app!.product.theme.get();
  const { result } = await searchParams;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{c.intro}</p>
      </div>
      {result && (
        <p role="status" className={`rounded-md border p-3 text-sm ${result === "done" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
          {c.result[result] ?? c.result.failed}
        </p>
      )}

      <form action={saveTheme} className="grid gap-6" data-testid="theme-form">
        <input type="hidden" name="locale" value={locale} />
        <fieldset className="grid gap-3">
          <legend className="mb-2 font-semibold">{c.theme}</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {THEME_NAMES.map((name) => {
              const t = THEMES[name];
              const p = t[t.native];
              return (
                <label key={name} className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary" data-theme-option={name}>
                  {/* Preview in the theme's own palette and heading font: decorative, the text below names it. */}
                  <span aria-hidden="true" className="grid gap-2 p-4" style={{ background: p.background, color: p.foreground }}>
                    <span className="text-3xl leading-tight" style={{ fontFamily: THEME_HEADING_FONT[name] }}>
                      Miền Bắc
                    </span>
                    <span className="flex gap-1.5">
                      {[p.background, p.muted, p.foreground, p.primary].map((color, i) => (
                        <span key={i} className="size-6 border" style={{ background: color, borderColor: p.border }} />
                      ))}
                    </span>
                  </span>
                  <span className="flex gap-3 p-4 text-sm">
                    <input type="radio" name="theme" value={name} defaultChecked={current.theme === name} className="mt-1" />
                    <span className="grid gap-1">
                      <span className="font-medium">
                        {c.themes[name].name}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">({c.nativeOf(c.native[t.native])})</span>
                        {current.theme === name && <span className="ml-2 text-xs font-normal text-primary">· {c.current}</span>}
                      </span>
                      <span className="text-muted-foreground">{c.themes[name].text}</span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="grid max-w-2xl gap-2">
          <legend className="mb-2 font-semibold">{c.mode}</legend>
          {THEME_MODES.map((mode) => (
            <label key={mode} className="flex items-start gap-3 text-sm">
              <input type="radio" name="mode" value={mode} defaultChecked={current.mode === mode} className="mt-1" />
              {c.modes[mode]}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit">{c.save}</Button>
          <a href={localePath(locale)} target="_blank" rel="noopener" className="text-sm text-primary underline underline-offset-4">
            {c.view}
          </a>
        </div>
      </form>
    </div>
  );
}
