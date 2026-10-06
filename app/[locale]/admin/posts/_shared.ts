import { notFound } from "next/navigation";
import { requireStaff } from "@/app/_lib/admin";
import { blogConfig } from "@/config/blog";
import { features } from "@/config/features";

/** Staff (editor+) and the content module, only when the blog reads posts from it (blog source "content"). */
export async function requirePostsAdmin() {
  const ctx = await requireStaff("editor");
  if (!ctx.container.content || !features.blog || blogConfig.source !== "content") notFound();
  return { ...ctx, content: ctx.container.content };
}

export const inputClass = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm";
