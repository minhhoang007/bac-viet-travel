// Starter-owned. Projects override in config/app.ts (ADR-0004).
export const appDefaults = {
  name: "Minh Starter",
  locales: ["vi", "en"] as const,
  defaultLocale: "vi" as const,
  /** Wall-clock time zone for staff inputs and dates shown in the admin (e.g. scheduled publishing). */
  timeZone: "Asia/Ho_Chi_Minh",
};
