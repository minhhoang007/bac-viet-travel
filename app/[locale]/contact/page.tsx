import { getSeoSite } from "@/bootstrap/seo";
import type { Metadata } from "next";
import { Clock, ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import { submitContact } from "@/app/actions/contact";
import { ContactForm } from "@/components/marketing/contact-form";
import { Container } from "@/components/ui/container";
import { createMetadata, serializeJsonLd } from "@/core/seo";
import type { Locale } from "@/config/app";
import { contactConfig, telUrl, whatsappUrl, zaloUrl } from "@/config/contact";
import { features } from "@/config/features";
import { getMarketingContent } from "@/content";
import { getProductContent } from "@/product/content";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const c = getProductContent(locale).contactPage;
  return createMetadata(getSeoSite(), { title: c.title, description: c.description, path: "/contact", locale });
}

// The map opens in Google Maps (a new tab): the site's CSP allows no third-party frames, and no Google cookies here.
const mapUrl = () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${contactConfig.address}, ${contactConfig.city}`)}`;

/** Contact channels (chat first), office with a map link, opening hours and the contact form. */
export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const p = getProductContent(locale);
  const c = p.contactPage;
  const m = getMarketingContent(locale);
  const chat = [
    { key: "zalo", icon: MessageCircle, label: p.contact.zalo, value: contactConfig.hotline, hint: c.zaloHint, href: zaloUrl() },
    { key: "whatsapp", icon: MessageCircle, label: p.contact.whatsapp, value: contactConfig.hotline, hint: c.whatsappHint, href: whatsappUrl() },
  ];
  // Vietnamese visitors use Zalo first, international visitors WhatsApp.
  const channels = [
    ...(locale === "vi" ? chat : [...chat].reverse()),
    { key: "hotline", icon: Phone, label: "Hotline", value: contactConfig.hotline, hint: c.hotlineHint, href: telUrl() },
    { key: "email", icon: Mail, label: "Email", value: contactConfig.email, hint: c.emailHint, href: `mailto:${contactConfig.email}` },
  ];
  const agencyLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: contactConfig.companyName,
    telephone: contactConfig.hotline,
    email: contactConfig.email,
    address: { "@type": "PostalAddress", streetAddress: contactConfig.address, addressLocality: contactConfig.city, addressCountry: "VN" },
    openingHours: "Mo-Su 08:00-21:00",
  };

  return (
    <Container className="py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(agencyLd) }} />
      <h1 className="font-heading type-h1">{c.title}</h1>
      <p className="mt-4 max-w-2xl type-lead text-muted-foreground">{c.intro}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-8">
          <section aria-labelledby="channels-title">
            <h2 id="channels-title" className="font-heading type-h3">
              {c.channelsTitle}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="contact-channels">
              {channels.map(({ key, icon: Icon, label, value, hint, href }) => (
                <li key={key}>
                  <a
                    href={href}
                    {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    data-channel={key}
                    className="flex h-full gap-3 border border-border p-4 transition hover:border-primary/60 hover:bg-muted/50"
                  >
                    <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{label}</span>
                      <span className="block break-words type-body">{value}</span>
                      <span className="mt-1 block type-small text-muted-foreground">{hint}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="office-title" className="bg-muted p-5">
            <h2 id="office-title" className="font-heading type-h3">
              {c.officeTitle}
            </h2>
            <p className="mt-3 flex gap-2 type-body">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                {contactConfig.address}
              </span>
            </p>
            <p className="mt-2 flex gap-2 type-body">
              <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              {contactConfig.businessHours[locale]}
            </p>
            <a href={mapUrl()} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4" data-testid="map-link">
              {c.openMap}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
            <p className="mt-4 type-small text-muted-foreground">
              {contactConfig.legalName} · {contactConfig.licenseType[locale]}: {contactConfig.licenseNumber}
            </p>
          </section>
        </div>

        <section aria-labelledby="form-title" className="border border-border p-6">
          <h2 id="form-title" className="font-heading type-h3">
            {c.formTitle}
          </h2>
          <p className="mt-1 type-small text-muted-foreground">{c.formHint}</p>
          <div className="mt-5">{features.email ? <ContactForm action={submitContact} labels={m.contact} /> : null}</div>
        </section>
      </div>
    </Container>
  );
}
