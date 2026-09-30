import { AppError } from "@/core/errors";
import type { RateLimiter } from "@/core/security/rate-limit";
import type { BetterAuthInstance } from "./adapters/better-auth";

export type Role = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
}

export interface AuthService {
  /** Sign-in methods actually available (config + credentials). */
  methods: { magicLink: boolean; google: boolean };
  /** Current user, or null. Disabled users are treated as signed out. */
  getUser(headers: Headers): Promise<AuthUser | null>;
  /** Throws AUTH_ERROR when not signed in. */
  requireUser(headers: Headers): Promise<AuthUser>;
  /** Throws AUTH_ERROR / PERMISSION_ERROR. */
  requireRole(headers: Headers, role: Role): Promise<AuthUser>;
  /**
   * Rate limited per client and per recipient (throws RATE_LIMIT_ERROR). Server-side `auth.api.*` calls bypass
   * Better Auth's HTTP limiter, so the limit lives here. errorCallbackURL receives `?error=...` for bad links.
   */
  signInMagicLink(input: MagicLinkRequest, headers: Headers): Promise<void>;
  /** Returns the provider URL to redirect to. */
  signInGoogle(callbackURL: string, headers: Headers): Promise<string>;
  signOut(headers: Headers): Promise<void>;
  /** Raw HTTP handler for /api/auth/*. */
  handler(request: Request): Promise<Response>;
}

export interface MagicLinkRequest {
  email: string;
  callbackURL: string;
  errorCallbackURL: string;
  /** Client identifier for rate limiting (usually the IP). */
  clientKey: string;
}

export interface AuthRateLimits {
  perClient: RateLimiter;
  perRecipient: RateLimiter;
}

export function createAuthService(
  auth: BetterAuthInstance,
  methods: AuthService["methods"],
  limits: AuthRateLimits,
): AuthService {
  const getUser = async (headers: Headers): Promise<AuthUser | null> => {
    const session = await auth.api.getSession({ headers });
    if (!session) return null;
    const u = session.user as typeof session.user & { role?: string; status?: string };
    if (u.status === "disabled") return null;
    return { id: u.id, email: u.email, name: u.name, image: u.image ?? null, role: u.role === "admin" ? "admin" : "user" };
  };

  const requireUser = async (headers: Headers) => {
    const user = await getUser(headers);
    if (!user) throw new AppError("AUTH_ERROR");
    return user;
  };

  return {
    methods,
    getUser,
    requireUser,
    async requireRole(headers, role) {
      const user = await requireUser(headers);
      if (role === "admin" && user.role !== "admin") throw new AppError("PERMISSION_ERROR");
      return user;
    },
    async signInMagicLink({ email, callbackURL, errorCallbackURL, clientKey }, headers) {
      const [client, recipient] = await Promise.all([
        limits.perClient.limit(`magic-link:client:${clientKey}`),
        limits.perRecipient.limit(`magic-link:to:${email.trim().toLowerCase()}`),
      ]);
      if (!client.success || !recipient.success) throw new AppError("RATE_LIMIT_ERROR");
      await auth.api.signInMagicLink({ body: { email, callbackURL, errorCallbackURL }, headers });
    },
    async signInGoogle(callbackURL, headers) {
      const res = await auth.api.signInSocial({ body: { provider: "google", callbackURL }, headers });
      if (!res.url) throw new AppError("AUTH_ERROR", "Google sign-in unavailable");
      return res.url;
    },
    async signOut(headers) {
      await auth.api.signOut({ headers });
    },
    handler: (request) => auth.handler(request),
  };
}
