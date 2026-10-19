import Image from "next/image";
import { PageLink } from "@/components/layout/page-transition";
import type { PostListItem } from "@/components/blog/post-list";
import { cn } from "@/components/ui/cn";

export interface MagazinePost extends PostListItem {
  cover?: string;
  /** The post's first topic as readers see it (e.g. "Hạ Long"): eyebrow above the title, and the stand-in for a missing cover. */
  topic?: string;
  bestTime?: string;
}

/**
 * Blog list as a travel magazine: the newest post large (when `featured`), the rest in a photo grid.
 * Each card is one link (the title, stretched over the card), so a phone tap anywhere opens the post.
 */
export function BlogMagazine({
  posts,
  featured,
  empty,
  bestTimeLabel,
}: {
  posts: MagazinePost[];
  featured: boolean;
  empty: string;
  bestTimeLabel: string;
}) {
  if (posts.length === 0) return <p className="text-muted-foreground">{empty}</p>;
  const lead = featured ? posts[0] : undefined;
  const rest = featured ? posts.slice(1) : posts;
  return (
    <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" data-testid="post-list">
      {lead && (
        <li className="sm:col-span-2 lg:col-span-3">
          <Card post={lead} lead bestTimeLabel={bestTimeLabel} />
        </li>
      )}
      {rest.map((p) => (
        <li key={p.href}>
          <Card post={p} bestTimeLabel={bestTimeLabel} />
        </li>
      ))}
    </ul>
  );
}

function Card({ post, lead = false, bestTimeLabel }: { post: MagazinePost; lead?: boolean; bestTimeLabel: string }) {
  return (
    <article className={cn("group relative grid gap-5", lead && "lg:grid-cols-[3fr_2fr] lg:items-center lg:gap-10")}>
      <div className="relative aspect-[3/2] overflow-hidden bg-muted">
        {post.cover ? (
          <Image
            src={post.cover}
            alt=""
            fill
            priority={lead}
            unoptimized={!post.cover.startsWith("/")}
            sizes={lead ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
            className="object-cover transition duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center p-6 text-center font-heading type-h3 text-muted-foreground">
            {post.topic}
          </span>
        )}
      </div>
      <div>
        {post.topic && <p className="type-eyebrow text-primary">{post.topic}</p>}
        <h2 className={cn("mt-3 font-heading group-hover:text-primary", lead ? "type-h2" : "type-h3 line-clamp-2")}>
          <PageLink href={post.href} className="after:absolute after:inset-0">
            {post.title}
          </PageLink>
        </h2>
        <p className={cn("mt-3 type-body text-muted-foreground", !lead && "line-clamp-2")}>{post.description}</p>
        {post.bestTime && (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">{bestTimeLabel}:</span> {post.bestTime}
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {post.date} · {post.readingTime}
        </p>
      </div>
    </article>
  );
}
