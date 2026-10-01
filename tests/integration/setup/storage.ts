import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

/** docker compose `storage` service (SeaweedFS, S3-compatible), standing in for Cloudflare R2. */
export const TEST_STORAGE = {
  endpoint: process.env.TEST_STORAGE_ENDPOINT ?? "http://localhost:58333",
  bucket: "minh-test",
  accessKeyId: "devaccess",
  secretAccessKey: "devsecret-local-only",
};

export async function ensureBucket(bucket = TEST_STORAGE.bucket) {
  const client = new S3Client({ endpoint: TEST_STORAGE.endpoint, region: "auto", forcePathStyle: true, credentials: TEST_STORAGE });
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (!(error instanceof Error && /BucketAlready(Exists|OwnedByYou)/.test(error.name))) throw error;
  }
}
