// Starter-owned. Projects override in config/auth.ts (ADR-0004).
export const authDefaults = {
  /** Sign-in methods. Magic link requires the email module. Google requires GOOGLE_CLIENT_ID/SECRET. */
  methods: { magicLink: true, google: true },
  /** Providers whose verified emails may be linked to an existing account (SECURITY.md). */
  trustedProviders: ["google"] as string[],
  /** Where users land after signing in (without locale prefix). */
  afterSignInPath: "/dashboard",
  signInPath: "/login",
  /**
   * Staff (editor, admin) sign-in policy: a second factor (passkey or authenticator app) for the admin area, sessions
   * that end after `sessionHours`, and a fresh second factor (within `freshMinutes`) before sensitive actions.
   */
  staff: { requireSecondFactor: true, sessionHours: 12, freshMinutes: 10 },
  /** Account security page (passkeys, authenticator app, backup codes, devices) and the second-factor check. */
  securityPath: "/security",
  verifyPath: "/verify",
};
