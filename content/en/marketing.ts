import type { MarketingContent } from "../types";

export const marketing: MarketingContent = {
  meta: {
    title: "A starter for websites and web apps",
    description: "Minh Starter helps you ship service websites and web apps quickly, reliably and maintainably.",
  },
  nav: { features: "Features", faq: "FAQ", contact: "Contact", switchLocale: "Tiếng Việt" },
  hero: {
    eyebrow: "Minh Web App Starter",
    title: "Build the product, not the plumbing",
    subtitle: "Config, content, SEO, security and architecture are ready. Focus on what makes your product unique.",
    primaryCta: "Get started",
    secondaryCta: "See features",
  },
  features: {
    title: "What's included",
    items: [
      { title: "Multilingual", description: "Vietnamese and English, with content separated from UI." },
      { title: "SEO ready", description: "Metadata, sitemap, robots and hreflang generated for you." },
      { title: "Verified architecture", description: "Layering rules are checked automatically in CI." },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      { question: "Who is this starter for?", answer: "Service websites and web apps that need a stable, reusable foundation." },
      { question: "Do I need a database?", answer: "Not for the site profile. Only the app profile needs a database and login." },
    ],
  },
  cta: { title: "Ready to start?", subtitle: "Clone the starter, adjust the config and build your product.", button: "Contact" },
  footer: { rights: "All rights reserved." },
  notFound: { title: "Page not found", back: "Back to home" },
};
