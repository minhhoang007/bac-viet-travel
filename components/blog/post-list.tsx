import { PageLink } from "@/components/layout/page-transition";

export interface PostListItem {
  href: string;
  title: string;
  description: string;
  date: string;
  readingTime: string;
  tags: { label: string; href: string }[];
}

export function PostList({ posts, empty }: { posts: PostListItem[]; empty: string }) {
  if (posts.length === 0) return <p className="text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-8" data-testid="post-list">
      {posts.map((p) => (
        <li key={p.href}>
          <article>
            <h2 className="text-xl font-semibold">
              <PageLink href={p.href} className="hover:underline">
                {p.title}
              </PageLink>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.date} · {p.readingTime}
            </p>
            <p className="mt-2">{p.description}</p>
            {p.tags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                {p.tags.map((t) => (
                  <li key={t.href}>
                    <PageLink href={t.href} className="rounded-full border border-border px-2 py-0.5 hover:bg-muted">
                      #{t.label}
                    </PageLink>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}

export function Pagination({ previous, next }: { previous?: { href: string; label: string }; next?: { href: string; label: string } }) {
  if (!previous && !next) return null;
  return (
    <nav className="mt-10 flex justify-between text-sm">
      {previous ? <PageLink href={previous.href}>← {previous.label}</PageLink> : <span />}
      {next && <PageLink href={next.href}>{next.label} →</PageLink>}
    </nav>
  );
}
