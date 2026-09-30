// Project-owned.
import { appDefaults } from "./app.defaults";

export const appConfig = { ...appDefaults };
export type Locale = (typeof appConfig.locales)[number];
