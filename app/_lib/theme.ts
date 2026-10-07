import { unstable_cache } from "next/cache";
import { getContainer } from "@/bootstrap/container";
import { DEFAULT_THEME, THEME_CACHE_TAG, type ThemeChoice } from "@/product/theme/themes";

const load = unstable_cache(async () => getContainer().app?.product.theme.get() ?? DEFAULT_THEME, ["site-theme"], { tags: [THEME_CACHE_TAG] });
const fallbackTag = unstable_cache(async () => true, ["site-theme:fallback"], { tags: [THEME_CACHE_TAG] });

/**
 * The site theme an admin picked (Admin → Giao diện), from the data cache so static pages stay static; saving a
 * theme revalidates THEME_CACHE_TAG. A build without a database, or a failing read, renders the default theme
 * (still through a tagged entry, so the next save regenerates the page).
 */
export async function currentTheme(): Promise<ThemeChoice> {
  try {
    getContainer();
  } catch {
    await fallbackTag();
    return DEFAULT_THEME;
  }
  try {
    return await load();
  } catch {
    await fallbackTag();
    return DEFAULT_THEME;
  }
}
