import type { ReactNode } from "react";

/** A part of the page that failed to load. Use a safe message (AppError), never a raw error. */
export function ErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="grid gap-2 rounded-lg border border-destructive/40 p-4 text-sm">
      <p className="font-medium text-destructive">{title}</p>
      {description && <p className="text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
