"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Opens the one-time sign-in link in this browser (a real navigation, so the browser receives the session cookie).
 * Only a press opens it: mail scanners that load the page do not press buttons.
 */
export function OpenLinkButton({ href, label, pendingLabel }: { href: string; label: string; pendingLabel: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      className="h-11 w-full"
      disabled={pending}
      data-testid="confirm-sign-in-button"
      onClick={() => {
        setPending(true);
        window.location.assign(href);
      }}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
