import { ROLES } from "@/core/users/schema";

type Role = (typeof ROLES)[number];

/** Staff sign-in policy (config/auth.ts `staff`). */
export interface StaffAuthPolicy {
  /** Editors and admins need a second factor (passkey with user verification, or TOTP) for the admin area. */
  requireSecondFactor: boolean;
  /** A staff session ends this many hours after sign-in, whatever its activity. */
  sessionHours: number;
  /** Sensitive actions need a second factor passed within this many minutes (step-up). */
  freshMinutes: number;
}

export interface SessionFacts {
  createdAt: Date;
  secondFactorAt: Date | null;
}

export interface FactorFacts {
  passkeys: number;
  totp: boolean;
}

/** Editors and admins (roles are ordered: user < editor < admin). */
export const isStaffRole = (role: string) => ROLES.indexOf(role as Role) >= ROLES.indexOf("editor");

/** A staff session older than sessionHours is over (the user signs in again). */
export function staffSessionExpired(role: Role, session: SessionFacts, policy: StaffAuthPolicy, now = new Date()): boolean {
  return isStaffRole(role) && now.getTime() - session.createdAt.getTime() > policy.sessionHours * 3_600_000;
}

export const hasSecondFactor = (factors: FactorFacts) => factors.passkeys > 0 || factors.totp;

/**
 * What a staff member must do before the admin area: "enroll" (no second factor yet), "verify" (this session has not
 * passed it) or "ok".
 */
export function staffGate(role: Role, session: SessionFacts, factors: FactorFacts, policy: StaffAuthPolicy): "ok" | "enroll" | "verify" {
  if (!policy.requireSecondFactor || !isStaffRole(role)) return "ok";
  if (!hasSecondFactor(factors)) return "enroll";
  return session.secondFactorAt ? "ok" : "verify";
}

/** The session passed a second factor within freshMinutes (sensitive actions, removing a factor). */
export function isFresh(session: SessionFacts, policy: StaffAuthPolicy, now = new Date()): boolean {
  return session.secondFactorAt !== null && now.getTime() - session.secondFactorAt.getTime() <= policy.freshMinutes * 60_000;
}
