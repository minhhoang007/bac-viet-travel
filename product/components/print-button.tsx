"use client";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog (also "Save as PDF"). */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} data-testid="voucher-print">
      {label}
    </Button>
  );
}
