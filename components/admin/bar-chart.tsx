export interface BarChartProps {
  /** Accessible name of the chart. */
  label: string;
  data: { label: string; value: number }[];
}

/** Dependency-free bar chart (CSS only); each bar has a title tooltip with its label and value. */
export function BarChart({ label, data }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div role="img" aria-label={label} className="flex h-32 items-end gap-0.5">
      {data.map((d) => (
        <div
          key={d.label}
          title={`${d.label}: ${d.value}`}
          className="flex-1 rounded-t bg-primary/70 hover:bg-primary"
          style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
