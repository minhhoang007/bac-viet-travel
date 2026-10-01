/** S3-compatible object storage (Cloudflare R2 in production). Implemented in providers/storage/. */
export interface ObjectStorage {
  /** Presigned URL the browser PUTs the file to directly (the file never passes through our server). */
  presignPut(input: { key: string; contentType: string; contentLength: number; expiresIn: number }): Promise<{ url: string; headers: Record<string, string> }>;
  /** Presigned download URL that forces a download with the original file name. */
  presignGet(input: { key: string; filename: string; expiresIn: number }): Promise<string>;
  /** Object metadata, or null when the object does not exist. */
  head(key: string): Promise<{ size: number; contentType: string | null } | null>;
  /** Deletes objects; missing keys are not an error. */
  delete(keys: string[]): Promise<void>;
}
