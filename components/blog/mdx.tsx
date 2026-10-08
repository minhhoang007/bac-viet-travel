import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import NextLink from "next/link";
import { isPagePath } from "@/components/ui/button";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";

/** Highlighted note inside a post (MDX tag `Callout`, optional `tone="warning"`). */
export function Callout({ tone = "info", children }: { tone?: "info" | "warning"; children: ReactNode }) {
  return (
    <aside className={tone === "warning" ? "my-6 rounded-md border border-warning/50 bg-warning/10 p-4" : "my-6 rounded-md border border-border bg-muted p-4"}>
      {children}
    </aside>
  );
}

/** Optimized image with a caption: <Figure src="/blog/a.jpg" alt="…" width={1200} height={630} caption="…" />. */
export function Figure({ caption, ...props }: ComponentProps<typeof Image> & { caption?: string }) {
  return (
    <figure className="my-6">
      <Image {...props} alt={props.alt} className="rounded-md" sizes="(min-width: 768px) 720px, 100vw" />
      {caption && <figcaption className="mt-2 text-center text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

function Link({ href = "", ...props }: ComponentProps<"a">) {
  if (isPagePath(href)) return <NextLink href={href} {...props} />;
  const external = /^https?:\/\//.test(href);
  return <a href={href} {...props} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} />;
}

function Img(props: ComponentProps<"img">) {
  // eslint-disable-next-line @next/next/no-img-element -- markdown images have no size; use the Figure component for optimized images
  return <img {...props} alt={props.alt ?? ""} loading="lazy" decoding="async" className="my-6 rounded-md" />;
}

export const mdxComponents = { a: Link, img: Img, Callout, Figure };

/**
 * Renders trusted MDX (posts committed to the repo) on the server, at build time for prerendered pages.
 * Never pass user-submitted text or anything stored in the database (staff-edited content): MDX can execute code.
 * Use MarkdownContent (components/blog/markdown.tsx) for those.
 */
export async function MdxContent({ source }: { source: string }) {
  const { default: Content } = await evaluate(source, { ...runtime, remarkPlugins: [remarkGfm] });
  return <Content components={mdxComponents} />;
}
