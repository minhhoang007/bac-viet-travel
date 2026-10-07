import { notFound } from "next/navigation";
import { Pagination, PostList } from "@/components/blog/post-list";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { requireBlog, toListItem } from "./_shared";

const pageHref = (locale: Locale, n: number) => localePath(locale, n === 1 ? "/blog" : `/blog/page/${n}`);

/** Blog index (page 1 at /blog, others at /blog/page/<n>). */
export async function BlogIndex({ locale, page }: { locale: Locale; page: number }) {
  const blog = await requireBlog();
  const c = getAppContent(locale).blog;
  const result = blog.page(locale, page);
  if (result.page !== page) notFound();
  const tags = blog.tags(locale);

  return (
    <Container className="max-w-3xl py-16">
      <h1 className="blog-title text-3xl font-bold">{c.title}</h1>
      <p className="mt-2 text-muted-foreground">
        {c.subtitle}{" "}
        <a href={localePath(locale, "/blog/rss.xml")} className="text-sm underline">
          {c.rss}
        </a>
      </p>
      {tags.length > 0 && (
        <nav aria-label={c.tags} className="blog-tags mt-6 flex flex-wrap gap-2 text-sm">
          {tags.map((t) => (
            <a key={t.tag} href={localePath(locale, `/blog/tag/${t.tag}`)} className="rounded-full border border-border px-3 py-1 hover:bg-muted">
              #{t.tag} <span className="text-muted-foreground">{t.count}</span>
            </a>
          ))}
        </nav>
      )}
      <div className="mt-10">
        <PostList posts={result.posts.map((p) => toListItem(p, locale))} empty={c.empty} />
      </div>
      <Pagination
        previous={page > 1 ? { href: pageHref(locale, page - 1), label: c.previous } : undefined}
        next={page < result.totalPages ? { href: pageHref(locale, page + 1), label: c.next } : undefined}
      />
    </Container>
  );
}
