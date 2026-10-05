/** Image hosting with on-the-fly transformations (Cloudinary). Implemented in providers/media/. */
export interface MediaProvider {
  /** Origins for the Content-Security-Policy: where the browser uploads to and loads images from. */
  origins: { upload: string; images: string };
  /** Fields the browser posts (multipart) with the file to `url`. Signed: the provider rejects other formats. */
  signUpload(input: { publicId: string; allowedFormats: readonly string[] }): { url: string; fields: Record<string, string> };
  /** What the provider actually stored, or null when there is no such image. */
  fetch(publicId: string): Promise<{ width: number; height: number; format: string; bytes: number; version: number } | null>;
  /** Deletes the image; a missing image is not an error. */
  destroy(publicId: string): Promise<void>;
  /** Delivery URL: modern format, compressed; resized/cropped around the focal point when width/height are given. */
  url(image: { publicId: string; version: number; format: string }, options?: { width?: number; height?: number; focal?: { x: number; y: number } }): string;
}
