import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { contactConfig, telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { features } from "@/config/features";
import { Logo } from "../brand/logo";
import { getProductContent } from "../content";
import { DESTINATIONS } from "../tours/catalog";

/** The one site footer (ProductFooter): company identity and licence, tours, company pages, policies. */
export function SiteFooter({ locale }: { locale: Locale }) {
  const c = getProductContent(locale);
  const f = c.footer;
  const n = c.footerNav;
  const href = (path: string) => localePath(locale, path);
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
    <footer className="mt-16 bg-foreground text-sm text-background/75">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-4" data-testid="company-info">
          <a href={href("/")} aria-label={c.header.home} className="w-fit">
            <Logo tone="dark" size="sm" />
          </a>
          <div className="grid gap-1 leading-relaxed">
            <p className="font-semibold text-background">{contactConfig.legalName}</p>
            <p>
              {f.taxCode}: {contactConfig.taxCode}
            </p>
            <p>
              {contactConfig.licenseType[locale]}: {contactConfig.licenseNumber}
            </p>
            <p>
              {f.representative}: {contactConfig.representative}
            </p>
            <p>
              {f.address}: {contactConfig.address}
            </p>
            <p>
              {f.hotline}:{" "}
              <a href={telUrl()} className="text-background underline underline-offset-2">
                {contactConfig.hotline}
              </a>{" "}
              · {contactConfig.businessHours[locale]}
            </p>
            <p>
              Email:{" "}
              <a href={`mailto:${contactConfig.email}`} className="text-background underline underline-offset-2">
                {contactConfig.email}
              </a>
            </p>
          </div>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-4 font-sans text-xs font-semibold tracking-[0.14em] text-background uppercase">{col.title}</h2>
            <ul className="grid gap-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <a href={href(l.href)} className="hover:text-background hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t border-background/10">
        <Container className="flex flex-col gap-3 py-5 text-xs text-background/60 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {contactConfig.companyName}. {n.rights}
          </span>
          <span className="flex flex-wrap items-center gap-4">
            {contactConfig.moitNoticeUrl && (
              <a href={contactConfig.moitNoticeUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-background">
                ✓ {f.moit}
              </a>
            )}
            <a href={zaloUrl()} className="hover:text-background">
              Zalo
            </a>
            <a href={whatsappUrl(c.contact.whatsappText())} className="hover:text-background">
              WhatsApp
            </a>
          </span>
        </Container>
      </div>
    </footer>
  );
}
