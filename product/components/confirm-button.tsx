"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/**
 * Submit button that asks the browser to confirm first (destructive or customer-facing admin actions). The form is
 * checked before the question, so a missing reason shows first instead of after "OK".
 */
export function ConfirmButton({ question, ...props }: ComponentProps<typeof Button> & { question: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (form && !form.reportValidity()) return event.preventDefault();
        if (!window.confirm(question)) event.preventDefault();
      }}
    />
  );
}
