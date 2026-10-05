import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { contactConfig, telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { ContactButtons } from "./components/contact-buttons";
import { getProductContent } from "./content";

/** Site-wide travel elements: the company's legal block under the footer and floating quick-contact buttons. */
export function ProductLayoutExtras({ locale }: { locale: Locale }) {
  const content = getProductContent(locale);
  const c = content.contact;
  const f = content.footer;
  const zalo = { key: "zalo" as const, label: c.zalo, href: zaloUrl() };
  const whatsapp = { key: "whatsapp" as const, label: c.whatsapp, href: whatsappUrl(c.whatsappText()) };
  const call = { key: "call" as const, label: c.call, href: telUrl() };
  // Vietnamese visitors: Zalo first. International visitors: WhatsApp first.
  const items = locale === "vi" ? [zalo, whatsapp, call] : [whatsapp, zalo, call];
  const links = [
    { href: "/about", label: f.about },
    { href: "/cancellation", label: f.cancellation },
    { href: "/payment", label: f.payment },
    { href: "/privacy", label: f.privacy },
    { href: "/terms", label: f.terms },
    { href: "/credits", label: content.credits.title },
  ];

  return (
    <>
      <div className="border-t border-border py-6 text-xs text-muted-foreground" data-testid="company-info">
        <Container className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="grid gap-1">
            <p className="font-semibold text-foreground">{contactConfig.legalName}</p>
            <p>
              {f.taxCode}: {contactConfig.taxCode} · {contactConfig.licenseType[locale]}: {contactConfig.licenseNumber}
            </p>
            <p>
              {f.representative}: {contactConfig.representative} · {f.address}: {contactConfig.address}
            </p>
            <p>
              {f.hotline}:{" "}
              <a href={telUrl()} className="hover:text-foreground">
                {contactConfig.hotline}
              </a>{" "}
              · Email:{" "}
              <a href={`mailto:${contactConfig.email}`} className="hover:text-foreground">
                {contactConfig.email}
              </a>{" "}
              · {f.hours}: {contactConfig.businessHours[locale]}
            </p>
          </div>
          <div className="grid content-start gap-3">
            <nav aria-label={f.nav}>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 md:justify-end">
                {links.map((l) => (
                  <li key={l.href}>
                    <a href={localePath(locale, l.href)} className="hover:text-foreground">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            {contactConfig.moitNoticeUrl && (
              <a href={contactConfig.moitNoticeUrl} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-foreground md:text-right">
                ✓ {f.moit}
              </a>
            )}
          </div>
        </Container>
      </div>
      <ContactButtons label={c.title} items={items} />
    </>
  );
}
