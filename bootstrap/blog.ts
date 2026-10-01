import { isModuleEnabled } from "@/core/module";
import { createBlog, type Blog } from "@/modules/blog";
import { appConfig } from "@/config/app";
import { blogConfig } from "@/config/blog";
import { features } from "@/config/features";

let cached: Blog | undefined;

/**
 * The blog, or undefined when the module is off. Separate from the container on purpose: blog pages are
 * prerendered and must not require runtime secrets. Drafts are visible outside production builds.
 */
export function getBlog(): Blog | undefined {
  if (!isModuleEnabled(features, "blog")) return undefined;
  return (cached ??= createBlog({
    dir: blogConfig.dir,
    locales: appConfig.locales,
    postsPerPage: blogConfig.postsPerPage,
    wordsPerMinute: blogConfig.wordsPerMinute,
    includeDrafts: process.env.NODE_ENV !== "production",
  }));
}
