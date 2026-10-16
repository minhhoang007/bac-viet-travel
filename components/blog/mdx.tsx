import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import { PageLink } from "@/components/layout/page-transition";
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
  if (isPagePath(href)) return <PageLink href={href} {...props} />;
  const external = /^https?:\/\//.test(href);
  return <a href={href} {...props} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} />;
}

const WIDTHS = [640, 960, 1600];

/**
 * Sizes an image CDN can serve for a Markdown image, and its shape when the URL says it (imgix `ar=3:2`, as picked
 * Unsplash photos carry): phones load a small file, and the page keeps the image's space before it loads.
 */
export function responsiveImage(src: string): { srcSet?: string; aspectRatio?: string } {
  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    const ar = url.searchParams.get("ar")?.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    const srcSet = WIDTHS.map((w) => {
      url.searchParams.set("w", String(w));
      return `${url} ${w}w`;
    }).join(", ");
    return { srcSet, aspectRatio: ar ? `${ar[1]} / ${ar[2]}` : undefined };
  }
  // Cloudinary: a width transformation in front of the stored image (format and quality picked per browser).
  const cloudinary = src.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  if (cloudinary) return { srcSet: WIDTHS.map((w) => `${cloudinary[1]}f_auto,q_auto,c_limit,w_${w}/${cloudinary[2]} ${w}w`).join(", ") };
  return {};
}

function Img(props: ComponentProps<"img">) {
  const { srcSet, aspectRatio } = typeof props.src === "string" ? responsiveImage(props.src) : {};
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Markdown images: CDN sizes through srcSet (next/image needs a size)
    <img
      {...props}
      alt={props.alt ?? ""}
      srcSet={srcSet}
      sizes={srcSet ? "(min-width: 768px) 768px, 100vw" : undefined}
      style={aspectRatio ? { aspectRatio, width: "100%", height: "auto", objectFit: "cover" } : undefined}
      loading="lazy"
      decoding="async"
      className="my-6 rounded-md"
    />
  );
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
