import { useLocale } from "next-intl";
import type { Locale } from "@/config/app";
import { getMarketingContent } from "@/content";
import { localePath } from "@/core/i18n/routing";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  const locale = useLocale() as Locale;
  const c = getMarketingContent(locale);
  return (
    <Container className="py-24 text-center">
      <h1 className="text-3xl font-bold">{c.notFound.title}</h1>
      <a href={localePath(locale)} className="mt-6 inline-block text-primary underline">
        {c.notFound.back}
      </a>
    </Container>
  );
}
