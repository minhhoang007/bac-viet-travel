export interface MarketingContent {
  meta: { title: string; description: string };
  nav: { features: string; faq: string; contact: string; switchLocale: string };
  hero: { eyebrow: string; title: string; subtitle: string; primaryCta: string; secondaryCta: string };
  features: { title: string; items: { title: string; description: string }[] };
  faq: { title: string; items: { question: string; answer: string }[] };
  cta: { title: string; subtitle: string; button: string };
  footer: { rights: string };
  notFound: { title: string; back: string };
}
