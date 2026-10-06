import { notFound } from "next/navigation";

// Unknown URLs under a locale render the site's 404 (app/[locale]/not-found.tsx: header, footer, translated text)
// instead of the framework's bare English page. Real routes always win over this catch-all.
export default function UnknownPage() {
  notFound();
}
