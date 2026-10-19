import { PageLink } from "@/components/layout/page-transition";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/blog/post-list";
import { Container } from "@/components/ui/container";
import { localePath } from "@/core/i18n/routing";
import type { Locale } from "@/config/app";
import { getAppContent } from "@/content";
import { BlogMagazine } from "@/product/components/blog-magazine";
import { requireBlog, tagLabel, toMagazineItem } from "./_shared";

const pageHref = (locale: Locale, n: number) => localePath(locale, n === 1 ? "/blog" : `/blog/page/${n}`);

/** Blog index (page 1 at /blog, others at /blog/page/<n>). */
export async function BlogIndex({ locale, page }: { locale: Locale; page: number }) {
  const blog = await requireBlog();
  const c = getAppContent(locale).blog;
  const result = blog.page(locale, page);
  if (result.page !== page) notFound();
  const tags = blog.tags(locale);

  return (
    <Container className="py-16">
      <h1 className="blog-title text-3xl font-bold">{c.title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        {c.subtitle}{" "}
        <a href={localePath(locale, "/blog/rss.xml")} className="text-sm underline">
          {c.rss}
        </a>
      </p>
      {tags.length > 0 && (
        <nav aria-label={c.tags} className="blog-tags -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 text-sm [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {tags.map((t) => (
            <PageLink key={t.tag} href={localePath(locale, `/blog/tag/${t.tag}`)} className="shrink-0 rounded-full border border-border px-3 py-1 hover:bg-muted">
              {tagLabel(t.tag, locale)} <span className="text-muted-foreground">{t.count}</span>
            </PageLink>
          ))}
        </nav>
      )}
      <div className="mt-10">
        <BlogMagazine posts={result.posts.map((p) => toMagazineItem(p, locale))} featured={page === 1} empty={c.empty} bestTimeLabel={c.facts.bestTime} />
      </div>
      <Pagination
        previous={page > 1 ? { href: pageHref(locale, page - 1), label: c.previous } : undefined}
        next={page < result.totalPages ? { href: pageHref(locale, page + 1), label: c.next } : undefined}
      />
    </Container>
  );
}
