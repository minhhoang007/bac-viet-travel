import { Children, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * A row of cards that phones swipe sideways (the next card peeks in, so it reads as "more"), and a plain grid from
 * `sm` up (`grid`: its columns and gaps there). CSS only: scroll snapping, no script, links stay in tab order.
 */
export function MobileRail({ children, grid, className, ...rest }: { children: ReactNode; grid: string; className?: string } & Record<`data-${string}`, string>) {
  return (
    <div
      {...rest}
      className={cn(
        "-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:overflow-visible sm:px-0 sm:pb-0",
        grid,
        className,
      )}
    >
      {Children.map(children, (child) => (
        <div className="flex w-[84%] shrink-0 snap-start flex-col sm:w-auto">{child}</div>
      ))}
    </div>
  );
}
