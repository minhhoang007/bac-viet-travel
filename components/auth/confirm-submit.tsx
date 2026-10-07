"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Submit button that asks first (browser confirm), for removing a sign-in method. */
export function ConfirmSubmit({ question, children, className }: { question: string; children: ReactNode; className?: string }) {
  return (
    <Button type="submit" variant="outline" className={className} onClick={(e) => (window.confirm(question) ? undefined : e.preventDefault())}>
      {children}
    </Button>
  );
}
