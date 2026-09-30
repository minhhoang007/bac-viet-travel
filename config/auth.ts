// Project-owned.
import { authDefaults } from "./auth.defaults";

export const authConfig = { ...authDefaults };
export type AuthConfig = typeof authConfig;
