import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { confirmSignIn } from "@/app/actions/security";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/app";
import { getSecurityContent } from "@/content/security";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ link?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getSecurityContent((await params).locale).signIn.confirmTitle, robots: { index: false } };
}

/**
 * The emailed sign-in link lands here, not on the one-time link itself: mailbox link scanners open (GET) pages but do
 * not press buttons, so they can no longer use the link up before the person does. The button posts the link to a
 * server action that only opens this site's own magic-link URL.
 */
export default async function ConfirmSignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { link } = await searchParams;
  const c = getSecurityContent(locale).signIn;

  return (
    <Container className="grid max-w-md gap-6 py-16">
      <h1 className="text-2xl font-bold">{c.confirmTitle}</h1>
      {link ? (
        <form action={confirmSignIn} className="grid gap-4" data-testid="confirm-sign-in">
          <p className="text-sm text-muted-foreground">{c.confirmText}</p>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="link" value={link} />
          <SubmitButton label={c.confirm} className="h-11 justify-self-stretch" />
        </form>
      ) : (
        <Notice tone="danger">{c.confirmInvalid}</Notice>
      )}
    </Container>
  );
}
