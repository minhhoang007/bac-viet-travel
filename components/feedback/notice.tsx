import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/cn";

const TONES = {
  info: "border-border bg-muted/50",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/50 bg-warning/10",
  danger: "border-danger/40 bg-danger/10 text-danger",
} as const;

/**
 * A message box: action outcomes, errors, warnings, notes. "danger" is announced at once (role="alert"); the others
 * politely (role="status"), or not at all with `role="note"` for static notes.
 */
type NoticeProps = Omit<HTMLAttributes<HTMLDivElement>, "role" | "title"> & { tone?: keyof typeof TONES; title?: string; children?: ReactNode; role?: "alert" | "status" | "note" };

export function Notice({ tone = "info", title, children, role, className, ...rest }: NoticeProps) {
  return (
    <div {...rest} role={role ?? (tone === "danger" ? "alert" : "status")} data-tone={tone} className={cn("rounded-md border p-3 text-sm", TONES[tone], className)}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={cn(title && "mt-1", "whitespace-pre-line")}>{children}</div>}
    </div>
  );
}
