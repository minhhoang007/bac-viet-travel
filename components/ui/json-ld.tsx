import { serializeJsonLd } from "@/core/seo/json-ld";

/** Structured data (schema.org) for search engines. `data` is escaped; never pass pre-serialized strings. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
