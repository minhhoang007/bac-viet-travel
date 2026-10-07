import { eq } from "drizzle-orm";
import { AppError } from "@/core/errors";
import type { ProductContext } from "@/core/product/context";
import type { Db } from "@/db/client";
import { siteSettings } from "../schema/settings";
import { DEFAULT_THEME, parseThemeChoice, type ThemeChoice } from "./themes";

type Actor = Parameters<NonNullable<ProductContext["audit"]>["audited"]>[0];

const KEY = "theme";

export interface ThemeService {
  /** The site theme an admin picked, or the default. */
  get(): Promise<ThemeChoice>;
  /** Save the site theme. Audited. */
  set(actor: Actor, choice: ThemeChoice): Promise<void>;
}

/** The caller regenerates the pages afterwards (THEME_CACHE_TAG): app/actions/theme.ts. */
export function createThemeService(deps: { db: Db; audit?: ProductContext["audit"] }): ThemeService {
  const { db } = deps;
  return {
    async get() {
      const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, KEY));
      return row ? parseThemeChoice(row.value) : DEFAULT_THEME;
    },

    async set(actor, choice) {
      if (!deps.audit) throw new AppError("MODULE_DISABLED", "Admin module is off");
      const value = parseThemeChoice(choice);
      await deps.audit.audited(actor, { action: "theme.set", targetType: "setting", targetId: KEY, metadata: { ...value } }, async () => {
        await db.insert(siteSettings).values({ key: KEY, value }).onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
        return true;
      });
    },
  };
}
