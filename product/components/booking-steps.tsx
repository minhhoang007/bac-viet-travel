import { Check } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { Locale } from "@/config/app";
import { getBookingContent } from "../booking/content";

/**
 * Where the guest is in the booking: 1 date & travellers (book page), 2 deposit (held booking), 3 confirmed
 * (deposit paid). `current` null: no step is active (expired, refund due).
 */
export function BookingSteps({ locale, current }: { locale: Locale; current: 1 | 2 | 3 | null }) {
  const t = getBookingContent(locale).steps;
  const steps = [t.choose, t.deposit, t.confirmed];
  return (
    <nav aria-label={t.label} data-testid="booking-steps">
      <ol className="flex items-center gap-2 text-sm">
        {steps.map((label, i) => {
          const n = i + 1;
          const done = current !== null && n < current;
          const active = n === current;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary ring-2 ring-primary/30",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : n}
              </span>
              <span className={cn("truncate", active ? "font-semibold" : "sr-only text-muted-foreground sm:not-sr-only")}>{label}</span>
              {n < steps.length && <span aria-hidden="true" className="hidden h-px flex-1 bg-border sm:block" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
