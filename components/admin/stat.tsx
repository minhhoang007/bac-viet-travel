import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

export interface StatDelta {
  /** e.g. "+12%" or "−3 so với tháng trước". */
  label: string;
  /** Direction of the change; "up" is shown as good unless `inverse`. */
  trend: "up" | "down" | "flat";
  /** For figures where up is bad (e.g. cancellations). */
  inverse?: boolean;
}

/** A figure card (admin/dashboard): label, value, optional change vs a previous period, optional hint and link. */
export function Stat({ label, value, href, delta, hint }: { label: string; value: string | number; href?: string; delta?: StatDelta; hint?: string }) {
  const good = delta && delta.trend !== "flat" && (delta.trend === "up") !== Boolean(delta.inverse);
  const Icon = delta?.trend === "up" ? ArrowUpRight : delta?.trend === "down" ? ArrowDownRight : ArrowRight;
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {delta && (
        <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${delta.trend === "flat" ? "text-muted-foreground" : good ? "text-success" : "text-danger"}`}>
          <Icon className="size-3.5" aria-hidden="true" />
          {delta.label}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  return href ? (
    <a href={href} className="block rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/60">
      {body}
    </a>
  ) : (
    <div className="rounded-lg border border-border bg-background p-4">{body}</div>
  );
}
