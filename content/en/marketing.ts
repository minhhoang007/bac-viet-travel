import type { MarketingContent } from "../types";

export const marketing: MarketingContent = {
  meta: {
    title: "A starter for websites and web apps",
    description: "Minh Starter helps you ship service websites and web apps quickly, reliably and maintainably.",
  },
  nav: { switchLocale: "Tiếng Việt", menu: "Open menu", close: "Close" },
  hero: {
    eyebrow: "Minh Web App Starter",
    title: "Build the product, not the plumbing",
    subtitle: "Config, content, SEO, security and architecture are ready. Focus on what makes your product unique.",
    primaryCta: "Get started",
    primaryHref: "#contact",
    secondaryCta: "See features",
    secondaryHref: "#features",
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
  contact: {
    name: "Name",
    email: "Email",
    message: "Message",
    submit: "Send",
    sending: "Sending…",
    success: "Thank you! We will get back to you soon.",
    errors: {
      required: "This field is required.",
      invalid_email: "Please enter a valid email.",
      too_long: "This is too long.",
      rate_limited: "Too many attempts. Please try again later.",
      error: "Could not send. Please try again.",
    },
  },
  footer: { rights: "All rights reserved." },
  error: {
    title: "Something went wrong",
    text: "Sorry, this page ran into a problem. Please try again in a moment.",
    retry: "Try again",
    back: "Back to home",
  },
  notFound: { title: "Page not found", back: "Back to home" },
};
