import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import type { Locale } from "@/config/app";
import { getProductContent } from "@/product/content";
import { photoCredits, unsplashPhotoUrl, unsplashUserUrl, videoCredits } from "@/product/tours/credits";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: getProductContent(locale).credits.title, robots: { index: false } };
}

export default async function CreditsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const c = getProductContent(locale).credits;
  return (
    <Container className="max-w-3xl py-14">
      <h1 className="text-3xl font-bold">{c.title}</h1>
      <p className="mt-2 text-muted-foreground">{c.text}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {photoCredits.map((p) => (
          <li key={p.file} className="flex items-center gap-3 text-sm">
            <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded">
              <Image src={p.file} alt="" fill sizes="96px" className="object-cover" />
            </span>
            <span>
              <a href={unsplashPhotoUrl(p.photo)} className="underline" target="_blank" rel="noopener noreferrer">
                Unsplash
              </a>{" "}
              ·{" "}
              <a href={unsplashUserUrl(p.username)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {p.author}
              </a>
            </span>
          </li>
        ))}
        {videoCredits.map((v) => (
          <li key={v.file} className="flex items-center gap-3 text-sm" data-testid="video-credit">
            <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded">
              <Image src={v.file} alt="" fill sizes="96px" className="object-cover" />
            </span>
            <span>
              <a href={v.url} className="underline" target="_blank" rel="noopener noreferrer">
                Pexels
              </a>{" "}
              · {v.author}
            </span>
          </li>
        ))}
      </ul>
    </Container>
  );
}
