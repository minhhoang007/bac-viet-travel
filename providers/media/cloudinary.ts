import { createHash } from "node:crypto";
import { AppError } from "@/core/errors";
import type { MediaProvider } from "@/modules/media";

/**
 * Cloudinary adapter over the REST API (no SDK). Signing: SHA-1 of the alphabetically sorted `key=value` parameters
 * joined with "&", followed by the API secret (https://cloudinary.com/documentation/authentication_signatures).
 */
export function cloudinarySignature(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== "" && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export function cloudinaryProvider(options: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  fetch?: typeof fetch;
  now?: () => Date;
}): MediaProvider {
  const http = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const api = `https://api.cloudinary.com/v1_1/${options.cloudName}`;
  const auth = `Basic ${Buffer.from(`${options.apiKey}:${options.apiSecret}`).toString("base64")}`;
  const timestamp = () => Math.floor(now().getTime() / 1000);
  // Public ids are "<folder>/<uuid>": keep them to that alphabet so they never need escaping in URLs.
  const safeId = (publicId: string) => {
    if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(publicId)) throw new AppError("VALIDATION_ERROR", "Invalid image id");
    return publicId;
  };

  return {
    origins: { upload: "https://api.cloudinary.com", images: "https://res.cloudinary.com" },

    signUpload({ publicId, allowedFormats }) {
      const params = { public_id: safeId(publicId), timestamp: timestamp(), allowed_formats: allowedFormats.join(","), overwrite: "false" };
      return {
        url: `${api}/image/upload`,
        fields: { ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: options.apiKey, signature: cloudinarySignature(params, options.apiSecret) },
      };
    },

    async fetch(publicId) {
      const res = await http(`${api}/resources/image/upload/${safeId(publicId)}`, { headers: { authorization: auth } });
      if (res.status === 404) return null;
      if (!res.ok) throw new AppError("INTERNAL_ERROR", `Cloudinary lookup failed (${res.status})`);
      const r = (await res.json()) as { width: number; height: number; format: string; bytes: number; version: number };
      return { width: r.width, height: r.height, format: r.format, bytes: r.bytes, version: r.version };
    },

    async destroy(publicId) {
      const params = { public_id: safeId(publicId), timestamp: timestamp(), invalidate: "true" };
      const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: options.apiKey, signature: cloudinarySignature(params, options.apiSecret) });
      const res = await http(`${api}/image/destroy`, { method: "POST", body });
      if (!res.ok) throw new AppError("INTERNAL_ERROR", `Cloudinary delete failed (${res.status})`);
      const { result } = (await res.json()) as { result?: string };
      if (result !== "ok" && result !== "not found") throw new AppError("INTERNAL_ERROR", `Cloudinary delete failed (${result})`);
    },

    url(image, { width, height, focal } = {}) {
      const t = ["f_auto", "q_auto"];
      if (width && height) {
        // Crop around the focal point. Cloudinary reads 0.0–1.0 as a fraction of the image and integers as pixels,
        // so keep the value strictly inside (0, 1): "1" would mean one pixel.
        const frac = (n: number) => Math.min(0.999, Math.max(0.001, n)).toFixed(3);
        t.push("c_fill", `w_${width}`, `h_${height}`);
        if (focal) t.push("g_xy_center", `x_${frac(focal.x)}`, `y_${frac(focal.y)}`);
      } else if (width) {
        t.push("c_limit", `w_${width}`);
      }
      return `https://res.cloudinary.com/${options.cloudName}/image/upload/${t.join(",")}/v${image.version}/${safeId(image.publicId)}.${image.format}`;
    },
  };
}
