"use server";

import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/app/_lib/admin";
import { createUnsplash, type UnsplashPick, type UnsplashResult } from "@/product/media/unsplash";

/** Staff only, and only when UNSPLASH_ACCESS_KEY is set (the key never reaches the browser). */
async function unsplash() {
  await requireStaff("editor");
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) notFound();
  return createUnsplash(key);
}

export async function searchUnsplash(text: string, page = 1): Promise<{ ok: true; results: UnsplashResult[] } | { ok: false }> {
  const client = await unsplash();
  const q = z.string().trim().min(2).max(100).safeParse(text);
  if (!q.success) return { ok: false };
  try {
    return { ok: true, results: await client.search(q.data, z.number().int().min(1).max(20).catch(1).parse(page)) };
  } catch {
    // Rate limit (50 calls an hour on a demo key) or Unsplash down: the picker says so, nothing else breaks.
    return { ok: false };
  }
}

export async function pickUnsplash(id: string): Promise<({ ok: true } & UnsplashPick) | { ok: false }> {
  const client = await unsplash();
  try {
    return { ok: true, ...(await client.pick(z.string().max(40).parse(id))) };
  } catch {
    return { ok: false };
  }
}
