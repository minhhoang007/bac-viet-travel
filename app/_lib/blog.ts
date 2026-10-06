import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import { getBlog } from "@/bootstrap/blog";
import { BLOG_CACHE_TAG, POST_CONTENT_TYPE } from "@/bootstrap/content-types";
import { getContainer } from "@/bootstrap/container";
import { isModuleEnabled } from "@/core/module";
import { blogFromPosts, postFromContent, type Blog, type Post } from "@/modules/blog";
import { appConfig } from "@/config/app";
import { blogConfig } from "@/config/blog";
import { features } from "@/config/features";

/** Published posts as plain JSON (what survives the data cache); revalidated on publish (content type "post"). */
const publishedPosts = unstable_cache(
  async () => (await getContainer().content?.listPublished(POST_CONTENT_TYPE))?.map((r) => ({ slug: r.slug, data: r.data })) ?? [],
  ["blog:published"],
  { tags: [BLOG_CACHE_TAG], revalidate: 3600 },
);

/**
 * The blog for pages, feeds and the sitemap; undefined when the module is off. Source "mdx": the files in the repo
 * (prerendered). Source "content": posts published in the admin, read at request time (builds have no database).
 */
export async function loadBlog(): Promise<Blog | undefined> {
  if (blogConfig.source !== "content") return getBlog();
  if (!isModuleEnabled(features, "blog")) return undefined;
  await connection();
  const posts = (await publishedPosts()).map((r) => postFromContent(r.slug, r.data, blogConfig.wordsPerMinute)).filter((p): p is Post => p !== null);
  return blogFromPosts(posts, { locales: appConfig.locales, postsPerPage: blogConfig.postsPerPage });
}

/** Static params only for file posts: database posts render on demand. */
export function fileBlog(): Blog | undefined {
  return blogConfig.source === "content" ? undefined : getBlog();
}
