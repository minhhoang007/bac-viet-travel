import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { contactConfig, telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { ContactButtons } from "./components/contact-buttons";
import { getProductContent } from "./content";

/** Site-wide travel elements: company/licence line under the footer and floating quick-contact buttons. */
export function ProductLayoutExtras({ locale }: { locale: Locale }) {
  const c = getProductContent(locale).contact;
  const zalo = { key: "zalo" as const, label: c.zalo, href: zaloUrl() };
  const whatsapp = { key: "whatsapp" as const, label: c.whatsapp, href: whatsappUrl(c.whatsappText()) };
  const call = { key: "call" as const, label: c.call, href: telUrl() };
  // Vietnamese visitors: Zalo first. International visitors: WhatsApp first.
  const items = locale === "vi" ? [zalo, whatsapp, call] : [whatsapp, zalo, call];

  return (
    <>
      <div className="border-t border-border py-4 text-xs text-muted-foreground">
        <Container className="flex flex-wrap justify-between gap-2">
          <span>
            {contactConfig.companyName} · {contactConfig.address} · {c.license}: {contactConfig.licenseNumber}
          </span>
          <span className="flex gap-3">
            <a href={`mailto:${contactConfig.email}`} className="hover:text-foreground">
              {contactConfig.email}
            </a>
            <a href={localePath(locale, "/credits")} className="hover:text-foreground">
              {getProductContent(locale).credits.title}
            </a>
          </span>
        </Container>
      </div>
      <ContactButtons label={c.title} items={items} />
    </>
  );
}
