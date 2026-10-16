// Unsplash photos put in posts before picks carried their shape (`ar`, product/media/unsplash.ts): add it, so the
// page keeps each image's space before it loads. The size comes from Unsplash's own CDN (imgix `fm=json`): no API
// key, no API quota, the photo itself is not downloaded.

const IMAGE = /!\[([^\]]*)\]\((https:\/\/images\.unsplash\.com\/[^)\s]+)\)/g;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Unsplash image URLs in Markdown that have no `ar` yet. */
export function missingRatios(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(IMAGE)].map((m) => m[2]!).filter((src) => !new URL(src).searchParams.has("ar")))];
}

/** The same Markdown with `ar=W:H` on each Unsplash image whose size is known; others unchanged. */
export function withRatios(markdown: string, sizes: ReadonlyMap<string, { width: number; height: number }>): string {
  return markdown.replace(IMAGE, (all, alt: string, src: string) => {
    const size = sizes.get(src);
    if (!size) return all;
    const url = new URL(src);
    const d = gcd(size.width, size.height);
    url.searchParams.set("ar", `${size.width / d}:${size.height / d}`);
    return `![${alt}](${url.toString().replace(/%3A/g, ":")})`;
  });
}

/** Pixel size of an Unsplash photo from its CDN metadata, or null. */
export async function unsplashSize(src: string, fetchFn: typeof fetch = fetch): Promise<{ width: number; height: number } | null> {
  const url = new URL(src);
  url.search = "?fm=json";
  const res = await fetchFn(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  const meta = (await res.json().catch(() => null)) as { PixelWidth?: unknown; PixelHeight?: unknown } | null;
  const width = Number(meta?.PixelWidth);
  const height = Number(meta?.PixelHeight);
  return width > 0 && height > 0 ? { width, height } : null;
}
