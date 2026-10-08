import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import type { Locale } from "@/config/app";
import { getMarketingContent } from "@/content";
import { localePath } from "@/core/i18n/routing";
import { Container } from "@/components/ui/container";
import * as productLayout from "@/product/layout";

// Optional project content under the 404 message (product/layout.tsx \`ProductNotFound\`): e.g. popular pages.
const ProductNotFound =
  "ProductNotFound" in productLayout ? (productLayout as { ProductNotFound?: (p: { locale: Locale }) => Promise<ReactNode> | ReactNode }).ProductNotFound : undefined;

export default function NotFound() {
  const locale = useLocale() as Locale;
  const c = getMarketingContent(locale);
  return (
    <Container className="py-24 text-center">
      <h1 className="text-3xl font-bold">{c.notFound.title}</h1>
      <Link href={localePath(locale)} className="mt-6 inline-block text-primary underline">
        {c.notFound.back}
      </Link>
      {ProductNotFound && <ProductNotFound locale={locale} />}
    </Container>
  );
}
