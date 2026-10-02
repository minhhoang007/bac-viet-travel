export interface MarketingContent {
  meta: { title: string; description: string };
  nav: { switchLocale: string; menu: string; close: string };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    /** Anchor ("#contact") or path without locale prefix ("/tours"). */
    primaryHref: string;
    secondaryCta: string;
    secondaryHref: string;
    /** Optional background photo (path under public/). */
    image?: { src: string; alt: string };
  };
  features: { title: string; items: { title: string; description: string }[] };
  /*
   * Optional landing blocks: a section shows only when its content is set.
   * Testimonials and logos must be real (with permission) — the starter ships none.
   */
  logos?: { title: string; items: { name: string; src: string; href?: string }[] };
  problemSolution?: { title: string; before: { title: string; items: string[] }; after: { title: string; items: string[] } };
  steps?: { title: string; items: { title: string; description: string }[] };
  testimonials?: { title: string; items: { quote: string; name: string; role?: string; avatar?: string }[] };
  pricing?: {
    title: string;
    subtitle?: string;
    plans: {
      name: string;
      price: string;
      period?: string;
      description?: string;
      features?: string[];
      /** `href`: anchor ("#contact") or path without locale prefix. */
      cta: { label: string; href: string };
      highlighted?: boolean;
      badge?: string;
    }[];
  };
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
  /** Unexpected error page (500). */
  error: { title: string; text: string; retry: string; back: string };
}
