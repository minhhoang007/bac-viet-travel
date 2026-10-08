import { Mail, MessageCircle, MessagesSquare, Phone, X, type LucideIcon } from "lucide-react";

export interface ContactButtonsProps {
  label: string;
  /** First item is shown most prominently (Zalo for Vietnamese pages, WhatsApp for English). */
  items: { key: "zalo" | "whatsapp" | "call" | "email"; label: string; href: string }[];
}

const ICON: Record<ContactButtonsProps["items"][number]["key"], LucideIcon> = { zalo: MessagesSquare, whatsapp: MessageCircle, call: Phone, email: Mail };

function Links({ items }: { items: ContactButtonsProps["items"] }) {
  return items.map((item) => {
    const Icon = ICON[item.key];
    return (
      <a
        key={item.key}
        href={item.href}
        data-contact={item.key}
        {...(item.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        // Quiet on the dark "Sơn Mài" theme: same pill for every channel, the brass icon tells them apart.
        className="flex h-11 items-center gap-2 rounded-full border border-border bg-background/95 px-4 text-sm whitespace-nowrap text-foreground shadow-lg backdrop-blur transition hover:border-primary"
      >
        <Icon aria-hidden="true" className="size-5 text-primary" />
        {item.label}
      </a>
    );
  });
}

/**
 * Floating quick contact (bottom right) on every page. Desktop: the channels as labelled pills. Phones: one round
 * button that opens them (three buttons covered form fields and text on a 390 px screen). No JavaScript: <details>.
 */
export function ContactButtons({ label, items }: ContactButtonsProps) {
  return (
    <nav aria-label={label} data-contact-buttons className="fixed bottom-4 right-4 z-40 max-lg:in-[body:has([data-mobile-book-bar])]:bottom-24">
      <div className="hidden flex-col items-end gap-2 sm:flex">
        <Links items={items} />
      </div>
      <details className="group sm:hidden">
        <summary className="ml-auto grid size-12 cursor-pointer list-none place-items-center rounded-full bg-primary text-primary-foreground shadow-lg [&::-webkit-details-marker]:hidden" aria-label={label} data-testid="contact-toggle">
          <MessagesSquare aria-hidden="true" className="size-5 group-open:hidden" />
          <X aria-hidden="true" className="hidden size-5 group-open:block" />
        </summary>
        <div className="absolute right-0 bottom-14 flex flex-col items-end gap-2">
          <Links items={items} />
        </div>
      </details>
    </nav>
  );
}
