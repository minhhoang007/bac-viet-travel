/**
 * Unsplash's API guidelines: every link back to Unsplash or a photographer carries the app's name as
 * `utm_source` (lowercase, words joined by "_") and `utm_medium=referral`. "Bắc Việt Travel" → "bac_viet_travel".
 */
export function unsplashUtm(appName: string): string {
  const source = appName
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `utm_source=${source}&utm_medium=referral`;
}

/** Photos hotlinked from Unsplash (its terms forbid copying them): credited with a link back to Unsplash too. */
export const isUnsplashPhoto = (src: string) => src.startsWith("https://images.unsplash.com/");
