/** Daily money bars with a value axis (top, middle, zero) and readable tooltips. CSS only, like the starter BarChart. */
export function MoneyChart({ label, data, format, axis }: { label: string; data: { label: string; value: number }[]; format: (v: number) => string; axis: (v: number) => string }) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  return (
    <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2" data-testid="money-chart">
      <div className="flex h-32 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums" aria-hidden="true">
        <span className="-translate-y-1/2">{axis(max)}</span>
        <span>{axis(max / 2)}</span>
        <span className="translate-y-1/2">0</span>
      </div>
      <div role="img" aria-label={label} className="relative flex h-32 items-end gap-0.5 border-b border-border">
        <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" aria-hidden="true" />
        <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" aria-hidden="true" />
        {data.map((d) => (
          <div
            key={d.label}
            title={`${d.label}: ${format(d.value)}`}
            className="relative flex-1 rounded-t bg-primary/70 hover:bg-primary"
            style={{ height: d.value > 0 ? `${Math.max(2, (d.value / max) * 100)}%` : "0" }}
          />
        ))}
      </div>
    </div>
  );
}

/** A round top for the axis (1, 2 or 5 × a power of ten) so the labels read easily. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}
