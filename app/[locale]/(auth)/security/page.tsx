import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireAppServices } from "@/app/_lib/session";
import { confirmTotp, deletePasskey, disableTotp, newBackupCodes, signOutDevice, signOutOtherDevices, startTotp } from "@/app/actions/security";
import { AddPasskeyButton } from "@/components/auth/passkey-buttons";
import { NewBackupCodes, TotpSetup } from "@/components/auth/totp-setup";
import { ConfirmSubmit } from "@/components/auth/confirm-submit";
import { Notice } from "@/components/feedback/notice";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/app";
import { authConfig } from "@/config/auth";
import { deviceLabel, isStaffRole } from "@/core/auth";
import { localePath } from "@/core/i18n/routing";
import { getSecurityContent } from "@/content/security";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ setup?: string; result?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getSecurityContent((await params).locale).page.title, robots: { index: false } };
}

const card = "grid gap-4 rounded-lg border border-border p-5";

/** Account security: passkeys, authenticator app, backup codes, signed-in devices and recent activity. */
export default async function SecurityPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const app = await requireAppServices();
  const h = await headers();
  const current = await app.auth.getSession(h);
  if (!current) redirect(localePath(locale, authConfig.signInPath));

  const c = getSecurityContent(locale).page;
  const { setup, result } = await searchParams;
  const [factors, passkeys, devices, events] = await Promise.all([
    app.auth.factors(current.user.id),
    app.auth.security.passkeys(h),
    app.auth.security.devices(h),
    app.auth.security.events(current.user.id),
  ]);
  const staff = isStaffRole(current.user.role);
  const fmt = (d: Date) => d.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
  const hidden = <input type="hidden" name="locale" value={locale} />;
  const freshLink = localePath(locale, `${authConfig.verifyPath}?fresh=1&next=${encodeURIComponent(authConfig.securityPath)}`);

  return (
    <Container className="grid max-w-3xl gap-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{c.title}</h1>
        {staff && factors.passkeys + (factors.totp ? 1 : 0) > 0 && (
          <a href={localePath(locale, "/admin")} className="text-sm text-primary underline underline-offset-4">
            {c.back}
          </a>
        )}
      </div>
      {setup && <Notice tone="warning">{c.enrollNotice}</Notice>}
      {result && (
        <p role="status" className={`rounded-md border p-3 text-sm ${result === "done" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
          {c.result[result] ?? c.result.failed}
          {result === "fresh" && (
            <a href={freshLink} className="ml-2 font-medium underline underline-offset-4">
              →
            </a>
          )}
        </p>
      )}

      <section className={card} aria-labelledby="passkeys-title" data-testid="security-passkeys">
        <div>
          <h2 id="passkeys-title" className="text-lg font-semibold">{c.passkeys}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{c.passkeysText}</p>
        </div>
        {passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{c.noPasskeys}</p>
        ) : (
          <ul className="grid gap-2">
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-2 text-sm">
                <span>
                  {p.name ?? "Passkey"}
                  {p.createdAt && <span className="ml-2 text-muted-foreground">{fmt(p.createdAt)}</span>}
                </span>
                <form action={deletePasskey}>
                  {hidden}
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmSubmit question={c.removeAsk} className="h-8 px-3">
                    {c.remove}
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AddPasskeyButton label={c.addPasskey} nameLabel={c.passkeyName} securityPath={localePath(locale, authConfig.securityPath)} />
      </section>

      <section className={card} aria-labelledby="totp-title" data-testid="security-totp">
        <div>
          <h2 id="totp-title" className="text-lg font-semibold">
            {c.totp}
            {factors.totp && <span className="ml-2 text-sm font-normal text-success">· {c.totpOn}</span>}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{c.totpText}</p>
        </div>
        {factors.totp ? (
          <div className="grid gap-4">
            <div>
              <h3 className="font-medium">{c.backupCodes}</h3>
              <div className="mt-2">
                <NewBackupCodes create={newBackupCodes} labels={{ create: c.newBackupCodes, text: c.backupText, fresh: c.result.fresh!, failed: c.result.failed! }} />
              </div>
            </div>
            <form action={disableTotp}>
              {hidden}
              <ConfirmSubmit question={c.totpDisableAsk} className="h-9 px-3">
                {c.totpDisable}
              </ConfirmSubmit>
            </form>
          </div>
        ) : (
          <TotpSetup
            start={startTotp}
            confirm={confirmTotp}
            locale={locale}
            labels={{ setup: c.totpSetup, scan: c.totpScan, key: c.totpKey, code: getSecurityContent(locale).verify.totp, confirm: c.totpConfirm, backupText: c.backupText, fresh: c.result.fresh!, failed: c.result.failed! }}
          />
        )}
      </section>

      <section className={card} aria-labelledby="devices-title" data-testid="security-devices">
        <h2 id="devices-title" className="text-lg font-semibold">{c.devices}</h2>
        <ul className="grid gap-2">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-2 text-sm" data-device={d.current ? "current" : "other"}>
              <span>
                {deviceLabel(d.userAgent)}
                {d.current && <span className="ml-2 font-medium text-primary">· {c.thisDevice}</span>}
                <span className="block text-muted-foreground">
                  {c.since} {fmt(d.createdAt)}
                  {d.ipAddress ? ` · ${d.ipAddress}` : ""}
                </span>
              </span>
              {!d.current && (
                <form action={signOutDevice}>
                  {hidden}
                  <input type="hidden" name="id" value={d.id} />
                  <Button type="submit" variant="outline" className="h-8 px-3">
                    {c.signOutDevice}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {devices.length > 1 && (
          <form action={signOutOtherDevices}>
            {hidden}
            <Button type="submit" variant="outline">
              {c.signOutOthers}
            </Button>
          </form>
        )}
      </section>

      <section className={card} aria-labelledby="activity-title">
        <h2 id="activity-title" className="text-lg font-semibold">{c.activity}</h2>
        <ul className="grid gap-1 text-sm" data-testid="security-activity">
          {events.map((e, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 border-t border-border pt-1">
              <span>
                {c.events[e.kind] ?? e.kind} · {deviceLabel(e.userAgent)}
              </span>
              <span className="tabular-nums text-muted-foreground">{fmt(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
