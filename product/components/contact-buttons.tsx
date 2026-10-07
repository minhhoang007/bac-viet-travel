import { Mail, MessageCircle, MessagesSquare, Phone, type LucideIcon } from "lucide-react";

export interface ContactButtonsProps {
  label: string;
  /** First item is shown most prominently (Zalo for Vietnamese pages, WhatsApp for English). */
  items: { key: "zalo" | "whatsapp" | "call" | "email"; label: string; href: string }[];
}


const ICON: Record<ContactButtonsProps["items"][number]["key"], LucideIcon> = { zalo: MessagesSquare, whatsapp: MessageCircle, call: Phone, email: Mail };

/** Floating quick-contact buttons (bottom right), visible on every page. */
export function ContactButtons({ label, items }: ContactButtonsProps) {
  return (
    <nav aria-label={label} data-contact-buttons className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 max-lg:in-[body:has([data-mobile-book-bar])]:bottom-24">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          data-contact={item.key}
          {...(item.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          // Quiet on the dark "Sơn Mài" theme: same dark pill for every channel, the brass icon tells them apart.
          className="flex h-11 items-center gap-2 rounded-full border border-border bg-background/90 px-4 text-sm text-foreground shadow-lg backdrop-blur transition hover:border-primary"
        >
          {(() => {
            const Icon = ICON[item.key];
            return <Icon aria-hidden="true" className="size-5 text-primary" />;
          })()}
          <span className="hidden sm:inline">{item.label}</span>
          <span className="sr-only sm:hidden">{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
