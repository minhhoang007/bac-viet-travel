"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { passkeyRegister, passkeySignIn, passkeysSupported } from "@/core/auth/adapters/passkey-client";
import { Button } from "@/components/ui/button";

const noSubscribe = () => () => {};
/** Server render: assume yes (no flash); the browser then answers for real. */
const usePasskeySupport = () => useSyncExternalStore(noSubscribe, passkeysSupported, () => true);

/** "Sign in with a passkey" (login page) or "Verify with a passkey" (second-factor page); then go to `next`. */
export function PasskeySignInButton({ label, failed, next, variant = "outline" }: { label: string; failed: string; next: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const supported = usePasskeySupport();
  if (!supported) return null;

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant={variant}
        className="h-11 w-full"
        disabled={pending}
        data-testid="passkey-sign-in"
        onClick={() =>
          start(async () => {
            setError(false);
            if (await passkeySignIn()) router.replace(next);
            else setError(true);
          })
        }
      >
        <KeyRound className="size-4" aria-hidden="true" />
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {failed}
        </p>
      )}
    </div>
  );
}

/** Registers a passkey on this device, then reloads the security page with the result. */
export function AddPasskeyButton({ label, nameLabel, securityPath }: { label: string; nameLabel: string; securityPath: string }) {
  const back = (result: string) => `${securityPath}?result=${result}`;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const supported = usePasskeySupport();
  if (!supported) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="grid gap-1 text-sm">
        {nameLabel}
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} className="h-10 rounded-md border border-border bg-background px-3 text-sm" />
      </label>
      <Button
        type="button"
        disabled={pending}
        data-testid="add-passkey"
        onClick={() =>
          start(async () => {
            const res = await passkeyRegister(name.trim() || undefined);
            router.replace(back(res.ok ? "done" : res.fresh ? "fresh" : "failed"));
            router.refresh();
          })
        }
      >
        <KeyRound className="size-4" aria-hidden="true" />
        {label}
      </Button>
    </div>
  );
}
