import type { MarketingContent } from "../types";

export const marketing: MarketingContent = {
  meta: {
    title: "Ha Long Bay, Ninh Binh and Sapa tours from Hanoi",
    description: "Bac Viet Travel: Ha Long Bay cruises, Trang An and Mua Cave, Sapa trekking. Transparent prices, small groups, local guides.",
  },
  nav: { switchLocale: "Tiếng Việt", menu: "Open menu", close: "Close" },
  hero: {
    eyebrow: "Ha Long · Ninh Binh · Sapa — private and small-group tours from Hanoi",
    title: "Northern Vietnam, at your own pace.",
    subtitle: "Overnight cruises on the bay, boat rides through the caves of Trang An, treks across rice terraces. Small groups, all-inclusive prices, 24/7 support on WhatsApp.",
    primaryCta: "See tours",
    primaryHref: "/tours",
    secondaryCta: "Ask us",
    secondaryHref: "#contact",
    image: { src: "/video/hero-poster.jpg", alt: "Ha Long Bay at sunset from above" },
  },
  features: {
    title: "Booking is easy",
    items: [
      { title: "1. Choose a tour", description: "Detailed itineraries with clear inclusions and exclusions." },
      { title: "2. Hold your seats", description: "Pick a departure date and hold seats online, or message us on WhatsApp for advice." },
      { title: "3. Confirm", description: "Pay by card (VNPay) or bank transfer and get your confirmation and itinerary by email." },
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
  error: {
    title: "Something went wrong",
    text: "Sorry, this page ran into a problem. Please try again in a moment.",
    retry: "Try again",
    back: "Back to home",
  },
  notFound: { title: "Page not found", back: "Back to home" },
};
