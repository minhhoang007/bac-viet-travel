"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

/** Submit button of the surrounding form: disabled and showing `pendingLabel` while the action runs. */
export function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className={cn("justify-self-start", className)}>
      {pending && pendingLabel ? pendingLabel : label}
    </Button>
  );
}
