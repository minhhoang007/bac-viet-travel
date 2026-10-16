"use client";

import { useContext, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { FormPendingContext } from "./form-pending";

type ButtonProps = ComponentProps<typeof Button>;

/**
 * Submit button of the surrounding form: disabled (and showing `pendingLabel`) while the action runs, so a double
 * click never submits twice. Use it for every form that posts to a server action.
 */
export function SubmitButton({ label, pendingLabel, className, variant, size = "lg" }: { label: string; pendingLabel?: string; className?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"] }) {
  const status = useFormStatus();
  const saving = useContext(FormPendingContext);
  const pending = status.pending || saving;
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending || undefined} className={cn("justify-self-start", className)}>
      {pending && pendingLabel ? pendingLabel : label}
    </Button>
  );
}
