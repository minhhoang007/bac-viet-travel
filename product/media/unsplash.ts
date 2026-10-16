// Unsplash photos for the image picker, following the API terms (help.unsplash.com, "Unsplash API Guidelines"):
// photos are hotlinked from images.unsplash.com (never copied), picking one calls its download endpoint, and every
// use credits the photographer with a link back (UTM parameters). The Access Key stays on the server.

export const UNSPLASH_UTM = "utm_source=bac_viet_travel&utm_medium=referral";
const API = "https://api.unsplash.com";

type Fetch = typeof fetch;

type ApiPhoto = {
  id: string;
  width: number;
  height: number;
  alt_description: string | null;
  urls: { raw: string; small: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
};

/** A search result as the picker shows it. */
export interface UnsplashResult {
  id: string;
  thumb: string;
  alt: string;
  author: string;
}

/** What a picked photo becomes in the content: a hotlinked URL and its credit. */
export interface UnsplashPick {
  src: string;
  alt: string;
  credit: { name: string; url: string };
}

// Search works far better in English: Vietnamese place names get "vietnam" so results stay on topic.
export function searchQuery(text: string): string {
  const q = text.trim().replace(/\s+/g, " ").slice(0, 100);
  return /vietnam|việt nam|viet nam/i.test(q) ? q : `${q} vietnam`;
}

const withUtm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${UNSPLASH_UTM}`;

export function createUnsplash(accessKey: string, http: Fetch = fetch) {
  const get = async (path: string): Promise<unknown> => {
    const res = await http(path.startsWith("http") ? path : `${API}${path}`, { headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" } });
    if (!res.ok) throw new Error(`unsplash ${res.status}`);
    return res.json();
  };

  return {
    async search(text: string, page = 1): Promise<UnsplashResult[]> {
      const q = encodeURIComponent(searchQuery(text));
      const { results } = (await get(`/search/photos?query=${q}&orientation=landscape&content_filter=high&per_page=24&page=${page}`)) as { results: ApiPhoto[] };
      return results.map((p) => ({ id: p.id, thumb: p.urls.small, alt: p.alt_description ?? "", author: p.user.name }));
    },

    /**
     * The user picked a photo: read it again on the server (never trust the browser's copy of the download link or
     * credit), count the download as the terms require, and return the hotlinked URL with its credit.
     */
    async pick(id: string): Promise<UnsplashPick> {
      if (!/^[\w-]{6,40}$/.test(id)) throw new Error("unsplash id");
      const photo = (await get(`/photos/${id}`)) as ApiPhoto;
      const download = new URL(photo.links.download_location);
      if (download.origin !== API) throw new Error("unsplash download link");
      await get(download.toString());
      return {
        // Unsplash serves the size and format asked for (imgix parameters): wide enough for a full-width cover.
        src: `${photo.urls.raw}&w=1600&q=80&auto=format&fit=crop`,
        alt: photo.alt_description ?? "",
        credit: { name: photo.user.name, url: withUtm(photo.user.links.html) },
      };
    },
  };
}

/**
 * Unsplash photos must load from Unsplash itself (its API terms), not through Next's image optimizer, which would
 * fetch and re-serve them from this site. Their CDN already resizes them: pass this as next/image `unoptimized`.
 */
export const isHotlinked = (src: string) => src.startsWith("https://images.unsplash.com/");
