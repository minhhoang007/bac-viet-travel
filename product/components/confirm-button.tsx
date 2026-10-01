"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/** Submit button that asks the browser to confirm first (destructive or customer-facing admin actions). */
export function ConfirmButton({ question, ...props }: ComponentProps<typeof Button> & { question: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(event) => {
        if (!window.confirm(question)) event.preventDefault();
      }}
    />
  );
}
