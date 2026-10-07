"use client";

import { useActionState } from "react";
import type { BackupCodesState, TotpSetupState } from "@/app/actions/security";
import { Button } from "@/components/ui/button";

type Labels = { setup: string; scan: string; key: string; code: string; confirm: string; backupText: string; fresh: string; failed: string };

/**
 * Authenticator-app setup: a button asks the server for a new secret, then shows the QR code (SVG made on the server
 * from our own otpauth URI), the setup key, the backup codes, and a form for the first code.
 */
export function TotpSetup({ start, confirm, locale, labels }: { start: (prev: TotpSetupState) => Promise<TotpSetupState>; confirm: (formData: FormData) => Promise<void>; locale: string; labels: Labels }) {
  const [state, action, pending] = useActionState(start, null);

  if (state?.status !== "setup") {
    return (
      <form action={action} className="grid gap-2">
        <Button type="submit" variant="outline" disabled={pending} data-testid="totp-start">
          {labels.setup}
        </Button>
        {state && (
          <p role="alert" className="text-sm text-danger">
            {state.status === "fresh" ? labels.fresh : labels.failed}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="grid gap-4" data-testid="totp-setup">
      <p className="text-sm text-muted-foreground">{labels.scan}</p>
      {/* SVG generated on the server by uqr from our own otpauth URI. */}
      <div className="size-44 bg-white p-2 [&>svg]:size-full" aria-hidden="true" dangerouslySetInnerHTML={{ __html: state.qr }} />
      <p className="text-sm">
        {labels.key}: <code className="break-all font-mono" data-testid="totp-key">{state.key}</code>
      </p>
      <BackupCodeList codes={state.backupCodes} text={labels.backupText} />
      <form action={confirm} className="grid max-w-xs gap-2">
        <input type="hidden" name="locale" value={locale} />
        <label className="grid gap-1 text-sm">
          {labels.code}
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9 ]{6,7}" className="h-10 rounded-md border border-border bg-background px-3 font-mono tracking-widest" />
        </label>
        <Button type="submit">{labels.confirm}</Button>
      </form>
    </div>
  );
}

/** New backup codes on demand (the old ones stop working); shown once. */
export function NewBackupCodes({ create, labels }: { create: (prev: BackupCodesState) => Promise<BackupCodesState>; labels: { create: string; text: string; fresh: string; failed: string } }) {
  const [state, action, pending] = useActionState(create, null);
  if (state?.status === "codes") return <BackupCodeList codes={state.codes} text={labels.text} />;
  return (
    <form action={action} className="grid gap-2">
      <Button type="submit" variant="outline" disabled={pending} data-testid="backup-codes-new">
        {labels.create}
      </Button>
      {state && (
        <p role="alert" className="text-sm text-danger">
          {state.status === "fresh" ? labels.fresh : labels.failed}
        </p>
      )}
    </form>
  );
}

function BackupCodeList({ codes, text }: { codes: string[]; text: string }) {
  return (
    <div className="grid gap-2 rounded-md border border-border p-3">
      <p className="text-sm text-muted-foreground">{text}</p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm" data-testid="backup-codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}
