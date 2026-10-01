import { beforeAll, describe, expect, it } from "vitest";
import { ensureBucket, TEST_STORAGE } from "@/tests/integration/setup/storage";
import { contentDisposition, s3Storage } from "./s3";

const storage = s3Storage(TEST_STORAGE);
const key = () => `test/${crypto.randomUUID()}`;

beforeAll(() => ensureBucket());

describe("s3Storage against an S3-compatible server", () => {
  it("presigned PUT → head → presigned GET with the original name → delete", async () => {
    const k = key();
    const body = "xin chào";
    const put = await storage.presignPut({ key: k, contentType: "text/plain", contentLength: Buffer.byteLength(body), expiresIn: 60 });
    expect((await fetch(put.url, { method: "PUT", headers: put.headers, body })).status).toBe(200);
    expect(await storage.head(k)).toEqual({ size: Buffer.byteLength(body), contentType: "text/plain" });

    const res = await fetch(await storage.presignGet({ key: k, filename: "tệp.txt", expiresIn: 60 }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(body);
    expect(res.headers.get("content-disposition")).toBe(contentDisposition("tệp.txt"));

    await storage.delete([k, "test/missing"]);
    expect(await storage.head(k)).toBeNull();
  });

  it("the signature covers content type and length", async () => {
    const k = key();
    const put = await storage.presignPut({ key: k, contentType: "text/plain", contentLength: 3, expiresIn: 60 });
    expect((await fetch(put.url, { method: "PUT", headers: { "content-type": "text/html" }, body: "abc" })).ok).toBe(false);
    expect((await fetch(put.url, { method: "PUT", headers: put.headers, body: "abcdef" })).ok).toBe(false);
    expect(await storage.head(k)).toBeNull();
  });

  it("an expired download URL is refused", async () => {
    const k = key();
    const put = await storage.presignPut({ key: k, contentType: "text/plain", contentLength: 1, expiresIn: 60 });
    await fetch(put.url, { method: "PUT", headers: put.headers, body: "a" });
    const url = await storage.presignGet({ key: k, filename: "a.txt", expiresIn: 1 });
    await new Promise((r) => setTimeout(r, 2100));
    expect((await fetch(url)).status).toBe(403);
    await storage.delete([k]);
  });
});

describe("contentDisposition", () => {
  it("keeps an ASCII fallback and the UTF-8 name, without header injection", () => {
    expect(contentDisposition('báo "cáo".pdf')).toBe(`attachment; filename="b_o _c_o_.pdf"; filename*=UTF-8''b%C3%A1o%20%22c%C3%A1o%22.pdf`);
  });
});
