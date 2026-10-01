import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorage } from "@/modules/storage";

export interface S3StorageOptions {
  /** R2: https://<account-id>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

/** RFC 6266 attachment header that keeps non-ASCII (e.g. Vietnamese) file names. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Path-style addressing, so the browser-facing origin is the endpoint itself (one CSP connect-src entry). */
export function s3Storage(options: S3StorageOptions): ObjectStorage {
  const client = new S3Client({
    endpoint: options.endpoint,
    region: options.region ?? "auto",
    forcePathStyle: true,
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    // R2 and other S3-compatible stores reject the newer default checksum headers on presigned PUTs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = options.bucket;

  return {
    async presignPut({ key, contentType, contentLength, expiresIn }) {
      const command = new PutObjectCommand({ Bucket, Key: key, ContentType: contentType, ContentLength: contentLength });
      const url = await getSignedUrl(client, command, { expiresIn, signableHeaders: new Set(["content-type", "content-length"]) });
      return { url, headers: { "content-type": contentType } };
    },
    async presignGet({ key, filename, expiresIn }) {
      const command = new GetObjectCommand({ Bucket, Key: key, ResponseContentDisposition: contentDisposition(filename) });
      return getSignedUrl(client, command, { expiresIn });
    },
    async head(key) {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { size: Number(res.ContentLength ?? 0), contentType: res.ContentType ?? null };
      } catch (error) {
        if (error instanceof S3ServiceException && (error.$metadata.httpStatusCode === 404 || error.name === "NotFound")) return null;
        throw error;
      }
    },
    async delete(keys) {
      for (let i = 0; i < keys.length; i += 1000) {
        const chunk = keys.slice(i, i + 1000);
        const res = await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } }));
        if (res.Errors?.length) throw new Error(`storage delete failed for ${res.Errors.length} object(s): ${res.Errors[0]?.Code}`);
      }
    },
  };
}
