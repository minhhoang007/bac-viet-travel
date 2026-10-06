"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

type State = { status: "not_payable" | "error" } | null;

export interface DepositButtonProps {
  action: (prev: State, formData: FormData) => Promise<State>;
  code: string;
  token: string;
  locale: "vi" | "en";
  label: string;
  errorText: string;
}

/** Posts to the deposit action, which redirects to VNPay. */
export function DepositButton({ action, code, token, locale, label, errorText }: DepositButtonProps) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending} data-testid="pay-deposit">
        {label}
      </Button>
      {state && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {errorText}
        </p>
      )}
    </form>
  );
}
