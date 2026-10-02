import type { ReactNode } from "react";

/** Shown instead of a list/table that has no rows yet. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
