import { IntentLink } from "./intent-link";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { currentCompany } from "@/app/_lib/company";
import { features } from "@/config/features";
import { getPublicEnv } from "@/bootstrap/env";
import { Logo } from "../brand/logo";
import { getProductContent } from "../content";
import { DESTINATIONS } from "../tours/catalog";

/** The one site footer (ProductFooter): company identity and licence, tours, company pages, policies. */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const contactConfig = await currentCompany();
  const c = getProductContent(locale);
  const f = c.footer;
  const n = c.footerNav;
  const href = (path: string) => localePath(locale, path);
  // Demo site: the notice on top already says it is a sample; keep the "(demo)" markers (launch:check) out of view.
  const shown = (value: string) => (getPublicEnv().demoMode ? value.replace(/\s*\(demo\)/g, "") : value);
  const columns = [
    {
      title: n.tours,
      links: [...DESTINATIONS.map((d) => ({ label: c.destinations[d].name, href: `/tours/${d}` })), { label: c.header.privateTours, href: "/#contact" }],
    },
    {
      title: n.company,
      links: [
        { label: f.about, href: "/about" },
        { label: c.contactPage.nav, href: "/contact" },
        { label: c.faqPage.nav, href: "/faq" },
        ...(features.blog ? [{ label: c.header.guide, href: "/blog" }] : []),
        { label: c.credits.title, href: "/credits" },
      ],
    },
    {
      title: n.policies,
      links: [
        { label: f.cancellation, href: "/cancellation" },
        { label: f.payment, href: "/payment" },
        { label: f.privacy, href: "/privacy" },
        { label: f.terms, href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="mt-24 border-t border-border bg-muted text-sm text-muted-foreground">
      {/* Phones and tablets: company on top, the three link lists side by side below. Desktop: one row. */}
      {/* md: the expanded contact buttons (bottom right) would cover the last links: leave room under them. */}
      <Container className="grid gap-10 py-14 md:pb-28 lg:grid-cols-[1.4fr_3fr] lg:pb-14">
        <div className="grid content-start gap-4" data-testid="company-info">
          <IntentLink href={href("/")} aria-label={c.header.home} className="w-fit">
            <Logo size="sm" />
          </IntentLink>
          <div className="grid max-w-md gap-1 leading-relaxed">
            <p className="font-semibold text-foreground">{shown(contactConfig.legalName)}</p>
            <p>
              {f.taxCode}: {shown(contactConfig.taxCode)}
            </p>
            <p>
              {contactConfig.licenseType[locale]}: {shown(contactConfig.licenseNumber)}
            </p>
            <p>
              {f.representative}: {shown(contactConfig.representative)}
            </p>
            <p>
              {f.address}: {shown(contactConfig.address)}
            </p>
            <p>
              {f.hotline}:{" "}
              <a href={telUrl(contactConfig.hotline)} className="text-foreground underline underline-offset-2">
                {contactConfig.hotline}
              </a>{" "}
              · {contactConfig.businessHours[locale]}
            </p>
            <p>
              Email:{" "}
              <a href={`mailto:${contactConfig.email}`} className="text-foreground underline underline-offset-2">
                {contactConfig.email}
              </a>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="type-eyebrow mb-3 font-sans text-primary">{col.title}</h2>
              <ul className="grid gap-0.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {/* Shown on every page, rarely followed: prefetched on intent only. py-1.5: a finger-sized target. */}
                    <IntentLink href={href(l.href)} className="inline-block py-1.5 hover:text-foreground hover:underline">
                      {l.label}
                    </IntentLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </Container>
      <div className="border-t border-border">
        {/* Left-aligned: the floating contact buttons sit over the bottom right corner. */}
        <Container className="flex flex-col gap-3 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-8">
          <span>
            © {new Date().getFullYear()} {contactConfig.companyName}. {n.rights}
          </span>
          <span className="flex flex-wrap items-center gap-4 [&>a]:py-1.5">
            {contactConfig.moitNoticeUrl && (
              <a href={contactConfig.moitNoticeUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-foreground">
                ✓ {f.moit}
              </a>
            )}
            <a href={zaloUrl(contactConfig.zalo)} className="hover:text-foreground">
              Zalo
            </a>
            <a href={whatsappUrl(c.contact.whatsappText(), contactConfig.whatsapp)} className="hover:text-foreground">
              WhatsApp
            </a>
          </span>
        </Container>
      </div>
    </footer>
  );
}
