import { describe, expect, it } from "vitest";
import { cloudinaryProvider, cloudinarySignature } from "./cloudinary";

const options = { cloudName: "demo", apiKey: "123456", apiSecret: "abcd", now: () => new Date(1_315_060_510_000) };

describe("Cloudinary adapter", () => {
  it("signs like Cloudinary's documented example", () => {
    // https://cloudinary.com/documentation/authentication_signatures
    expect(cloudinarySignature({ timestamp: 1315060510, public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" }, "abcd")).toBe(
      "bfd09f95f331f558cbd1320e67aa8d488770583e",
    );
  });

  it("signed upload: allowed formats and no overwrite are part of the signature; the secret never leaves the server", () => {
    const { url, fields } = cloudinaryProvider(options).signUpload({ publicId: "site/abc", allowedFormats: ["jpg", "png"] });
    expect(url).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    expect(fields).toMatchObject({ public_id: "site/abc", timestamp: "1315060510", allowed_formats: "jpg,png", overwrite: "false", api_key: "123456" });
    expect(fields.signature).toBe(cloudinarySignature({ public_id: "site/abc", timestamp: 1315060510, allowed_formats: "jpg,png", overwrite: "false" }, "abcd"));
    expect(JSON.stringify(fields)).not.toContain("abcd");
    expect(() => cloudinaryProvider(options).signUpload({ publicId: "../x y", allowedFormats: ["jpg"] })).toThrow();
  });

  it("delivery URLs: auto format/quality, width steps, crop around the focal point kept strictly inside (0, 1)", () => {
    const p = cloudinaryProvider(options);
    const img = { publicId: "site/abc", version: 42, format: "jpg" };
    expect(p.url(img)).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v42/site/abc.jpg");
    expect(p.url(img, { width: 640 })).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_640/v42/site/abc.jpg");
    expect(p.url(img, { width: 640, height: 480, focal: { x: 1, y: 0.25 } })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_640,h_480,g_xy_center,x_0.999,y_0.250/v42/site/abc.jpg",
    );
  });

  it("lookup and destroy go to the REST API with auth / signature; 404 is 'no such image'", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/resources/image/upload/site/missing")) return new Response("{}", { status: 404 });
      if (url.includes("/resources/")) return Response.json({ width: 800, height: 600, format: "jpg", bytes: 1234, version: 7 });
      return Response.json({ result: "ok" });
    }) as typeof globalThis.fetch;
    const p = cloudinaryProvider({ ...options, fetch });
    expect(await p.fetch("site/abc")).toEqual({ width: 800, height: 600, format: "jpg", bytes: 1234, version: 7 });
    expect(await p.fetch("site/missing")).toBeNull();
    expect((calls[0]!.init!.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("123456:abcd").toString("base64")}`);
    await p.destroy("site/abc");
    const body = calls.at(-1)!.init!.body as URLSearchParams;
    expect(calls.at(-1)!.url).toBe("https://api.cloudinary.com/v1_1/demo/image/destroy");
    expect(body.get("signature")).toBe(cloudinarySignature({ public_id: "site/abc", timestamp: 1315060510, invalidate: "true" }, "abcd"));
  });
});
