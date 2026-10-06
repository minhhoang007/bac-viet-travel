import type { ComponentProps } from "react";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { Callout, mdxComponents } from "./mdx";

// <Callout> / <Callout tone="warning"> … </Callout>: the only tag staff text may use.
const CALLOUT = /<Callout(?:\s+tone="(info|warning)")?\s*>([\s\S]*?)<\/Callout>/g;
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

function SafeLink({ href = "", ...props }: ComponentProps<"a">) {
  if (!SAFE_HREF.test(href)) return <span>{props.children}</span>;
  return mdxComponents.a({ href, ...props });
}

function SafeImg({ src, ...props }: ComponentProps<"img">) {
  return typeof src === "string" && /^(https:\/\/|\/(?!\/))/.test(src) ? mdxComponents.img({ src, ...props }) : null;
}

const components = { ...mdxComponents, a: SafeLink, img: SafeImg };

async function markdown(source: string) {
  // format "md": plain Markdown. No JSX, no {expressions}, no import/export, raw HTML dropped.
  const { default: Content } = await evaluate(source, { ...runtime, format: "md", remarkPlugins: [remarkGfm] });
  return <Content components={components} />;
}

/**
 * Renders Markdown written by staff in the admin (content stored in the database), plus <Callout> blocks.
 * Unlike MdxContent it never executes code, so it is safe for any text an editor can type.
 */
export async function MarkdownContent({ source }: { source: string }) {
  const parts: { tone?: "info" | "warning"; text: string }[] = [];
  let last = 0;
  for (const m of source.matchAll(CALLOUT)) {
    parts.push({ text: source.slice(last, m.index) });
    parts.push({ tone: (m[1] as "info" | "warning" | undefined) ?? "info", text: m[2]! });
    last = m.index + m[0].length;
  }
  parts.push({ text: source.slice(last) });
  const rendered = await Promise.all(parts.filter((p) => p.text.trim()).map(async (p) => ({ ...p, node: await markdown(p.text) })));
  return (
    <>
      {rendered.map((p, i) =>
        p.tone ? (
          <Callout key={i} tone={p.tone}>
            {p.node}
          </Callout>
        ) : (
          <div key={i} className="contents">
            {p.node}
          </div>
        ),
      )}
    </>
  );
}
