import type { ReactNode } from "react";
import { PostList, type PostListItem } from "@/components/blog/post-list";
import type { Locale } from "@/config/app";
import * as productLayout from "@/product/layout";

type ListProps = { locale: Locale; posts: PostListItem[]; featured: boolean; empty: string };

// Optional `ProductPostList` (product/layout.tsx): the project's own blog list (e.g. a photo grid). `featured`: the
// first page of the index, where a project may show the newest post larger.
const ProductPostList = "ProductPostList" in productLayout ? (productLayout as { ProductPostList?: (p: ListProps) => ReactNode }).ProductPostList : undefined;

/** Page width around the list: a project's list (often a grid) gets the full container, the starter's a column. */
export const postListWidth = ProductPostList ? "" : "max-w-3xl";

/** The blog index and tag pages' list: the project's, or the starter's. */
export function PostListView(props: ListProps) {
  return ProductPostList ? <ProductPostList {...props} /> : <PostList posts={props.posts} empty={props.empty} />;
}
