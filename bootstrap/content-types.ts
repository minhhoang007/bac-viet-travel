import { revalidateTag } from "next/cache";
import type { ContentTypeDefinition } from "@/core/product/context";
import { contentPostProblems } from "@/modules/blog";
import { blogConfig } from "@/config/blog";
import { features } from "@/config/features";

/** Cache tag of the blog built from published posts (blog source "content"). */
export const BLOG_CACHE_TAG = "blog";
export const POST_CONTENT_TYPE = "post";

/** Content types the starter itself registers: blog posts when the blog reads from the content module (ADR-0007). */
export function starterContentTypes(): Record<string, ContentTypeDefinition> {
  if (!features.blog || blogConfig.source !== "content") return {};
  return {
    [POST_CONTENT_TYPE]: {
      label: { vi: "Bài viết", en: "Post" },
      adminPath: (id) => `/admin/posts/${id}`,
      publicPath: (slug) => `/blog/${slug}`,
      validate: contentPostProblems,
      // Expire at once (not stale-while-revalidate): static pages regenerate from fresh posts on the next visit.
      onChange: () => revalidateTag(BLOG_CACHE_TAG, { expire: 0 }),
    },
  };
}
