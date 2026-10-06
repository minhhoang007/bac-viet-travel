import { unstable_cache } from "next/cache";
import { getBlog } from "@/bootstrap/blog";
import { BLOG_CACHE_TAG, POST_CONTENT_TYPE } from "@/bootstrap/content-types";
import { getContainer } from "@/bootstrap/container";
import { isModuleEnabled } from "@/core/module";
import { blogFromPosts, createBlog, postFromContent, type Blog, type Post } from "@/modules/blog";
import { appConfig } from "@/config/app";
import { blogConfig } from "@/config/blog";
import { features } from "@/config/features";

/** Published posts as plain JSON (what survives the data cache); revalidated on publish (content type "post"). */
const publishedPosts = unstable_cache(
  async () => (await getContainer().content?.listPublished(POST_CONTENT_TYPE))?.map((r) => ({ slug: r.slug, data: r.data })) ?? [],
  ["blog:published"],
  { tags: [BLOG_CACHE_TAG], revalidate: 3600 },
);

/** Old published slugs of posts → current ones (renamed in the admin); revalidated with the blog. */
const movedPosts = unstable_cache(async () => (await getContainer().content?.listMoved(POST_CONTENT_TYPE)) ?? [], ["blog:moved"], { tags: [BLOG_CACHE_TAG], revalidate: 3600 });

/** Current slug of a post once published under `slug` (permanent redirect); null for file posts and unknown slugs. */
export async function movedPost(slug: string): Promise<string | null> {
  if (blogConfig.source !== "content") return null;
  return (await movedPosts()).find((r) => r.from === slug)?.to ?? null;
}

const fileFallbackTag = unstable_cache(async () => true, ["blog:file-fallback"], { tags: [BLOG_CACHE_TAG] });

/** The content module, or undefined where it cannot be built (a build without runtime secrets). */
function reachableContent() {
  try {
    return getContainer().content;
  } catch {
    return undefined;
  }
}

/**
 * The blog for pages, feeds and the sitemap; undefined when the module is off. Source "mdx": the files in the repo.
 * Source "content": posts published in the admin, from the data cache (tag "blog"): blog pages are static and are
 * regenerated when a post is published. A build without a database renders the repo's files instead (the same
 * posts `blog:import` copies), until the first publish or the hourly revalidation.
 */
export async function loadBlog(): Promise<Blog | undefined> {
  if (blogConfig.source !== "content") return getBlog();
  if (!isModuleEnabled(features, "blog")) return undefined;
  if (!reachableContent()) {
    // Still read through a "blog"-tagged cache entry, so the first publish regenerates this page with database posts.
    await fileFallbackTag();
    return createBlog({ dir: blogConfig.dir, locales: appConfig.locales, postsPerPage: blogConfig.postsPerPage, wordsPerMinute: blogConfig.wordsPerMinute, includeDrafts: false });
  }
  const posts = (await publishedPosts()).map((r) => postFromContent(r.slug, r.data, blogConfig.wordsPerMinute)).filter((p): p is Post => p !== null);
  return blogFromPosts(posts, { locales: appConfig.locales, postsPerPage: blogConfig.postsPerPage });
}

/** Static params for file posts; database posts are generated on first request, then cached (ISR). */
export function fileBlog(): Blog | undefined {
  return blogConfig.source === "content" ? undefined : getBlog();
}
