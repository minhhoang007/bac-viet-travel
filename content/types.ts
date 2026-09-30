export interface MarketingContent {
  meta: { title: string; description: string };
  nav: { switchLocale: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    /** Anchor ("#contact") or path without locale prefix ("/tours"). */
    primaryHref: string;
    secondaryCta: string;
    secondaryHref: string;
  };
  features: { title: string; items: { title: string; description: string }[] };
  faq: { title: string; items: { question: string; answer: string }[] };
  cta: { title: string; subtitle: string; button: string };
  contact: {
    name: string;
    email: string;
    message: string;
    submit: string;
    sending: string;
    success: string;
    errors: { required: string; invalid_email: string; too_long: string; rate_limited: string; error: string };
  };
  footer: { rights: string };
  notFound: { title: string; back: string };
}
