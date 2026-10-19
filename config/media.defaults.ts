// Starter-owned. Projects override in config/media.ts (ADR-0004, ADR-0008).

export const mediaDefaults = {
  /** Folder on the media provider; one per project keeps a shared Cloudinary account tidy. */
  folder: "site",
  /** No SVG (active content) and no GIF: photos only. */
  allowedFormats: ["jpg", "png", "webp", "avif"] as string[],
  maxBytes: 10 * 1024 * 1024,
  /** Uploads one account may start per hour (a stolen staff account cannot fill the provider's storage). */
  maxUploadsPerHour: 100,
};

export type MediaConfigDefaults = typeof mediaDefaults;
