import type { ComponentProps, ReactNode } from "react";
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { Callout, mdxComponents } from "./mdx";
import { outline } from "./outline";

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

/**
 * ## and ### get the ids of outline() (table of contents, #links), handed out in order: React renders the headings in
 * source order, the same order outline() reads them.
 */
function withHeadingIds(source: string) {
  const ids = outline(source).map((h) => h.id);
  let next = 0;
  const heading = (Tag: "h2" | "h3") =>
    function Heading(props: ComponentProps<"h2">) {
      return <Tag {...props} id={ids[next++]} />;
    };
  return { ...components, h2: heading("h2"), h3: heading("h3") };
}

async function markdown(source: string, withIds: typeof components) {
  // format "md": plain Markdown. No JSX, no {expressions}, no import/export, raw HTML dropped.
  const { default: Content } = await evaluate(source, { ...runtime, format: "md", remarkPlugins: [remarkGfm] });
  return <Content components={withIds} />;
}

// <Name slug="…" />: a block the project draws (e.g. a tour card), given by the page as `embed`; unknown or missing: nothing.
const EMBED = /<([A-Z][A-Za-z]+)\s+slug="([a-z0-9-]{1,100})"\s*\/>/g;

type Part = { text: string; tone?: "info" | "warning" } | { embed: { name: string; slug: string } };

/**
 * Renders Markdown written by staff in the admin (content stored in the database), plus <Callout> blocks and the
 * project's embeds (`<Tour slug="…" />`). Unlike MdxContent it never executes code, so it is safe for any text an
 * editor can type: an embed is a name and a slug handed to the page's own component.
 */
export async function MarkdownContent({ source, embed }: { source: string; embed?: (name: string, slug: string) => ReactNode }) {
  const parts: Part[] = [];
  let last = 0;
  for (const m of source.matchAll(CALLOUT)) {
    parts.push(...splitEmbeds(source.slice(last, m.index)));
    parts.push({ tone: (m[1] as "info" | "warning" | undefined) ?? "info", text: m[2]! });
    last = m.index + m[0].length;
  }
  parts.push(...splitEmbeds(source.slice(last)));
  const withIds = withHeadingIds(source);
  const rendered = await Promise.all(
    parts.map(async (p) => ("embed" in p ? { node: embed?.(p.embed.name, p.embed.slug) ?? null } : p.text.trim() ? { tone: p.tone, node: await markdown(p.text, withIds) } : null)),
  );
  return (
    <>
      {rendered.map((p, i) =>
        !p ? null : "tone" in p && p.tone ? (
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

/** Start and end of each ``` / ~~~ code block: an embed written there is an example, shown as text. */
function codeBlocks(text: string): [number, number][] {
  const blocks: [number, number][] = [];
  let open: number | null = null;
  for (const m of text.matchAll(/^[ \t]*(```|~~~).*$/gm)) {
    if (open === null) open = m.index;
    else {
      blocks.push([open, m.index + m[0].length]);
      open = null;
    }
  }
  if (open !== null) blocks.push([open, text.length]);
  return blocks;
}

function splitEmbeds(text: string): Part[] {
  const parts: Part[] = [];
  const code = codeBlocks(text);
  let last = 0;
  for (const m of text.matchAll(EMBED)) {
    if (code.some(([a, b]) => m.index >= a && m.index < b)) continue;
    parts.push({ text: text.slice(last, m.index) });
    parts.push({ embed: { name: m[1]!, slug: m[2]! } });
    last = m.index + m[0].length;
  }
  parts.push({ text: text.slice(last) });
  return parts;
}
