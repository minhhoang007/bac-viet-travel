// Project-owned.
import { authDefaults } from "./auth.defaults";

// Staff sign in with email and password too (owner's choice, 2026-10-19); the second factor stays required.
export const authConfig = { ...authDefaults, methods: { ...authDefaults.methods, password: true } };
export type AuthConfig = typeof authConfig;
