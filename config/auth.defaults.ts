// Starter-owned. Projects override in config/auth.ts (ADR-0004).
export const authDefaults = {
  /** Sign-in methods. Magic link requires the email module. Google requires GOOGLE_CLIENT_ID/SECRET. */
  methods: { magicLink: true, google: true },
  /** Providers whose verified emails may be linked to an existing account (SECURITY.md). */
  trustedProviders: ["google"] as string[],
  /** Where users land after signing in (without locale prefix). */
  afterSignInPath: "/dashboard",
  signInPath: "/login",
};
