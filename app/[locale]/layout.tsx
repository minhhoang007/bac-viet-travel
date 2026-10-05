import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, localePath } from "@/core/i18n/routing";
import { appConfig, type Locale } from "@/config/app";
import { brand } from "@/config/brand";
import { siteNavigation } from "@/config/navigation";
import { getAppContent, getMarketingContent } from "@/content";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { themeCss } from "@/components/ui/theme";
import { AnalyticsTracker } from "@/components/analytics/tracker";
import { ConsentBanner } from "@/components/analytics/consent-banner";
import { features } from "@/config/features";
import { Toaster } from "@/components/ui/sonner";
import * as productLayout from "@/product/layout";
import { ProductLayoutExtras } from "@/product/layout";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Optional project footer replacing the starter one (product/layout.tsx `ProductFooter`; `in`: projects without it).
const ProductFooter = "ProductFooter" in productLayout ? (productLayout as { ProductFooter?: (p: { locale: Locale }) => ReactNode }).ProductFooter : undefined;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const c = getMarketingContent(locale as Locale);
  const { legal, consent, blog } = getAppContent(locale as Locale);
  const other = appConfig.locales.find((l) => l !== locale) ?? appConfig.defaultLocale;
  const home = localePath(locale);

  return (
    <html lang={locale}>
      <head>
        {/* Theme variables from config/brand.ts (validated color values only). */}
        <style dangerouslySetInnerHTML={{ __html: themeCss(brand.colors) }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <SiteHeader
            logoText={brand.logoText}
            homeHref={home}
            links={[
              ...siteNavigation.map((l) => ({ label: l.label[locale as Locale], href: localePath(locale, l.href) })),
              ...(features.blog ? [{ label: blog.nav, href: localePath(locale, "/blog") }] : []),
            ]}
            localeSwitch={{ label: c.nav.switchLocale, href: localePath(other), hrefLang: other }}
            menu={{ open: c.nav.menu, close: c.nav.close }}
          />
          <main className="flex-1">{children}</main>
          {ProductFooter ? (
            <ProductFooter locale={locale as Locale} />
          ) : (
            <SiteFooter
              name={appConfig.name}
              rights={c.footer.rights}
              year={new Date().getFullYear()}
              links={[
                { label: legal.terms, href: localePath(locale, "/terms") },
                { label: legal.privacy, href: localePath(locale, "/privacy") },
              ]}
            />
          )}
          <ProductLayoutExtras locale={locale as Locale} />
          <Toaster />
          {features.analytics && (
            <>
              <AnalyticsTracker />
              <ConsentBanner
                text={consent.text}
                accept={consent.accept}
                decline={consent.decline}
                privacyLabel={consent.privacyLink}
                privacyHref={localePath(locale, "/privacy")}
              />
            </>
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
