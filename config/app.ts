// Project-owned.
import { appDefaults } from "./app.defaults";

export const appConfig = { ...appDefaults, name: "Bắc Việt Travel" };
export type Locale = (typeof appConfig.locales)[number];
