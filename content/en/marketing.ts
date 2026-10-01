import type { MarketingContent } from "../types";

export const marketing: MarketingContent = {
  meta: {
    title: "Ha Long Bay, Ninh Binh and Sapa tours from Hanoi",
    description: "Bac Viet Travel: Ha Long Bay cruises, Trang An and Mua Cave, Sapa trekking. Transparent prices, small groups, local guides.",
  },
  nav: { switchLocale: "Tiếng Việt" },
  hero: {
    eyebrow: "Bac Viet Travel · Northern Vietnam tours from Hanoi",
    title: "Discover Ha Long Bay, Ninh Binh and Sapa your way",
    subtitle: "Overnight cruises on the bay, boat rides through the caves of Trang An, treks across rice terraces. Small groups, all-inclusive prices, 24/7 support on WhatsApp.",
    primaryCta: "See tours",
    primaryHref: "/tours",
    secondaryCta: "Ask us",
    secondaryHref: "#contact",
  },
  features: {
    title: "Booking is easy",
    items: [
      { title: "1. Choose a tour", description: "Detailed itineraries with clear inclusions and exclusions." },
      { title: "2. Send a request", description: "Use the form or message us on WhatsApp. No payment needed now." },
      { title: "3. Confirm", description: "We reply within 24 hours to confirm the date and price." },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      { question: "Do you pick up from my hotel?", answer: "Yes. All tours include free pick-up from hotels in Hanoi's Old Quarter." },
      { question: "When do I pay?", answer: "Once we confirm your date, a 30% deposit by bank transfer or card link; the rest before departure." },
      { question: "What is the cancellation policy?", answer: "Free cancellation up to 7 days before departure. Weather cancellations by the authorities are rescheduled or refunded." },
      { question: "Do children pay full price?", answer: "Children under 5 travel free; ages 5–10 pay 75% of the adult price (depending on the tour)." },
    ],
  },
  cta: { title: "Want a tailor-made itinerary?", subtitle: "Send us a message or chat with us on WhatsApp.", button: "Contact" },
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
  notFound: { title: "Page not found", back: "Back to home" },
};
