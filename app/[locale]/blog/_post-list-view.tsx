import type { ReactNode } from "react";
import { PostList, type PostListProps } from "@/components/blog/post-list";
import * as productLayout from "@/product/layout";

// Optional `ProductPostList` (product/layout.tsx): the project's own blog list (e.g. a photo grid).
const ProductPostList = "ProductPostList" in productLayout ? (productLayout as { ProductPostList?: (p: PostListProps) => ReactNode }).ProductPostList : undefined;

/** Page width around the list: a project's list (often a grid) gets the full container, the starter's a column. */
export const postListWidth = ProductPostList ? "" : "max-w-3xl";

/** The blog index and tag pages' list: the project's, or the starter's. */
export function PostListView(props: PostListProps) {
  return ProductPostList ? <ProductPostList {...props} /> : <PostList posts={props.posts} empty={props.empty} />;
}
