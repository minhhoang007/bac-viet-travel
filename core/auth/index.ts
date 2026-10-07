export { createAuthService, hasRole, type AuthService, type AuthSession, type AuthUser, type DeviceSession, type PasskeyInfo, type Role, type MagicLinkRequest, type AuthRateLimits } from "./service";
export { deviceLabel, type AuthEvent } from "./events";
export { hasSecondFactor, isStaffRole, type StaffAuthPolicy } from "./mfa";
export { checkAuthConfig, type AuthMethodsConfig } from "./config-check";
