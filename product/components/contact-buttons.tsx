import { Mail, MessageCircle, MessagesSquare, Phone, type LucideIcon } from "lucide-react";

export interface ContactButtonsProps {
  label: string;
  /** First item is shown most prominently (Zalo for Vietnamese pages, WhatsApp for English). */
  items: { key: "zalo" | "whatsapp" | "call" | "email"; label: string; href: string }[];
}

const STYLE: Record<ContactButtonsProps["items"][number]["key"], string> = {
  zalo: "bg-[#0068ff] text-white",
  whatsapp: "bg-[#25d366] text-[#052e16]",
  call: "bg-primary text-primary-foreground",
  email: "bg-background text-foreground border border-border",
};

const ICON: Record<ContactButtonsProps["items"][number]["key"], LucideIcon> = { zalo: MessagesSquare, whatsapp: MessageCircle, call: Phone, email: Mail };

/** Floating quick-contact buttons (bottom right), visible on every page. */
export function ContactButtons({ label, items }: ContactButtonsProps) {
  return (
    <nav aria-label={label} className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 max-lg:in-[body:has([data-mobile-book-bar])]:bottom-24">
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          data-contact={item.key}
          {...(item.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-lg transition hover:scale-105 ${STYLE[item.key]}`}
        >
          {(() => {
            const Icon = ICON[item.key];
            return <Icon aria-hidden="true" className="size-5" />;
          })()}
          <span className="hidden sm:inline">{item.label}</span>
          <span className="sr-only sm:hidden">{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
