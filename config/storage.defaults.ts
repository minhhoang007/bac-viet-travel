// Starter-owned. Projects override in config/storage.ts (ADR-0004).
// Per-user quota is the "storage.max_bytes" entitlement (config/billing.ts plans).

export const storageDefaults = {
  /** Accepted MIME types. Keep active content (HTML, SVG, JS) out: files are served from the storage domain. */
  allowedTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain", "text/csv"] as string[],
  maxFileBytes: 10 * 1024 * 1024,
  /** Seconds a presigned upload / download URL stays valid. */
  uploadUrlTtl: 300,
  downloadUrlTtl: 300,
};

export type StorageConfig = typeof storageDefaults;
