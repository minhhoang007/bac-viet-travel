import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAppServices } from "@/app/_lib/session";
import { signOut } from "@/app/actions/auth";
import { verifySecondFactor } from "@/app/actions/security";
import { PasskeySignInButton } from "@/components/auth/passkey-buttons";
import { Notice } from "@/components/feedback/notice";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/app";
import { authConfig } from "@/config/auth";
import { hasSecondFactor } from "@/core/auth";
import { localePath } from "@/core/i18n/routing";
import { getSecurityContent } from "@/content/security";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ next?: string; fresh?: string; error?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getSecurityContent((await params).locale).verify.title, robots: { index: false } };
}

const input = "h-11 rounded-md border border-border bg-background px-3 font-mono tracking-widest";

/** Second factor for this session (admin area, or a fresh one before a sensitive action). */
export default async function VerifyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const app = await requireAppServices();
  const h = await headers();
  const current = await app.auth.getSession(h);
  // No session but a password sign-in waiting for its code: only the authenticator app (or a backup code) finishes it.
  const pending = !current && app.auth.hasPendingSecondFactor(h);
  if (!current && !pending) redirect(localePath(locale, authConfig.signInPath));
  const factors = current ? await app.auth.factors(current.user.id) : { passkeys: 0, totp: true };
  if (!hasSecondFactor(factors)) redirect(localePath(locale, `${authConfig.securityPath}?setup=1`));

  const c = getSecurityContent(locale).verify;
  const sp = await searchParams;
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/admin";
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
    </>
  );

  return (
    <Container className="grid max-w-md gap-6 py-16">
      <div>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{sp.fresh ? c.fresh : c.intro}</p>
      </div>
      {sp.error === "expired" ? (
        <Notice tone="danger">
          {c.expired}{" "}
          <a href={localePath(locale, authConfig.signInPath)} className="font-medium underline underline-offset-4">
            {c.signInAgain}
          </a>
        </Notice>
      ) : (
        sp.error && <Notice tone="danger">{sp.error === "locked" ? c.locked : c.wrong}</Notice>
      )}

      {sp.error !== "expired" && factors.passkeys > 0 && <PasskeySignInButton label={c.passkey} failed={c.passkeyFailed} next={localePath(locale, next)} variant="default" />}

      {sp.error !== "expired" && factors.totp && (
        <>
          <form action={verifySecondFactor} className="grid gap-2" data-testid="verify-totp">
            {hidden}
            <label className="grid gap-1 text-sm">
              {c.totp}
              <input name="code" inputMode="numeric" autoComplete="one-time-code" required className={input} />
            </label>
            <Button type="submit" variant={factors.passkeys > 0 ? "outline" : "default"}>
              {c.totpSubmit}
            </Button>
          </form>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">{c.backup}</summary>
            <form action={verifySecondFactor} className="mt-3 grid gap-2" data-testid="verify-backup">
              {hidden}
              <input type="hidden" name="kind" value="backup" />
              <label className="grid gap-1">
                {c.backupCode}
                <input name="code" autoComplete="off" required className={input} />
              </label>
              <Button type="submit" variant="outline">
                {c.backupSubmit}
              </Button>
            </form>
          </details>
        </>
      )}

      {current && (
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="text-sm text-muted-foreground underline underline-offset-4">
            {c.signOut}
          </button>
        </form>
      )}
    </Container>
  );
}
