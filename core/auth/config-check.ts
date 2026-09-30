import type { Features } from "@/core/module";

export interface AuthMethodsConfig {
  methods: { magicLink: boolean; google: boolean };
}

/** Startup checks for auth (profile "app"). Returns problems instead of throwing. */
export function checkAuthConfig(
  features: Features,
  auth: AuthMethodsConfig,
  env: { GOOGLE_CLIENT_ID?: string },
): string[] {
  if (features.profile !== "app") return [];
  const problems: string[] = [];
  if (auth.methods.magicLink && !features.email) {
    problems.push('Auth method "magicLink" requires the "email" module to be enabled');
  }
  if (auth.methods.google && !env.GOOGLE_CLIENT_ID && !auth.methods.magicLink) {
    problems.push("No sign-in method available: set GOOGLE_CLIENT_ID/SECRET or enable magicLink");
  }
  return problems;
}
