import type { BookingStatus } from "@/product/schema/booking";

/**
 * Colour per status, from the theme tokens: blue = paid, green = done, amber = waiting, red = refund owed, grey = over.
 * The colour is on the border and dot; the text stays foreground so small labels keep WCAG AA contrast.
 */
const TONE = {
  held: ["border-warning/50 bg-warning/10", "bg-warning"],
  deposit_paid: ["border-primary/50 bg-primary/10", "bg-primary"],
  refund_due: ["border-danger/50 bg-danger/10", "bg-danger"],
  confirmed: ["border-success/50 bg-success/10", "bg-success"],
  cancelled: ["border-border bg-muted", "bg-muted-foreground"],
  expired: ["border-border bg-muted", "bg-muted-foreground"],
} satisfies Record<BookingStatus, [string, string]>;

export function BookingStatusBadge({ status, label }: { status: BookingStatus; label: string }) {
  const [box, dot] = TONE[status];
  return (
    <span data-admin-status={status} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 align-middle text-xs font-medium text-foreground ${box}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
