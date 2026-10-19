"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { status: "sent" | "rate_limited" | "error" } | null;

export interface ResendLinkLabels {
  title: string;
  intro: string;
  code: string;
  email: string;
  submit: string;
  sending: string;
  sent: string;
  rate_limited: string;
  error: string;
}

/** Lost booking link: code + booking email; the answer never says whether they matched. */
export function ResendLinkForm({ action, labels }: { action: (prev: State, formData: FormData) => Promise<State>; labels: ResendLinkLabels }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <section className="mt-10 border-t border-border pt-6" aria-labelledby="resend-link-title">
      <h2 id="resend-link-title" className="text-lg font-semibold">
        {labels.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.intro}</p>
      {state?.status === "sent" ? (
        <p role="status" data-resend="sent" className="mt-4 rounded-md border border-border bg-muted p-4 text-sm">
          {labels.sent}
        </p>
      ) : (
        <form action={formAction} className="mt-4 grid gap-3 sm:max-w-md" data-testid="resend-link">
          <div>
            <Label htmlFor="resend-code">{labels.code}</Label>
            <Input id="resend-code" name="code" required maxLength={20} autoCapitalize="characters" placeholder="BV-XXXXXX" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="resend-email">{labels.email}</Label>
            <Input id="resend-email" name="email" type="email" required maxLength={200} autoComplete="email" className="mt-1" />
          </div>
          {state && (
            <p role="alert" className="text-sm text-danger">
              {labels[state.status]}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? labels.sending : labels.submit}
          </Button>
        </form>
      )}
    </section>
  );
}
