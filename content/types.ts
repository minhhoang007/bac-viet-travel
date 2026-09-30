export interface MarketingContent {
  meta: { title: string; description: string };
  nav: { features: string; faq: string; contact: string; switchLocale: string };
  hero: { eyebrow: string; title: string; subtitle: string; primaryCta: string; secondaryCta: string };
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
