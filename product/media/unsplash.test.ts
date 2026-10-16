import { describe, expect, it } from "vitest";
import { createUnsplash, searchQuery } from "./unsplash";

const photo = {
  id: "abc123XYZ",
  width: 5000,
  height: 3000,
  alt_description: "boats on a bay",
  urls: { raw: "https://images.unsplash.com/photo-1?ixid=x", small: "https://images.unsplash.com/photo-1?w=400" },
  user: { name: "Duc Nguyen", links: { html: "https://unsplash.com/@duc" } },
  links: { download_location: "https://api.unsplash.com/photos/abc123XYZ/download?ixid=x" },
};

function fake() {
  const calls: { url: string; auth: string | null }[] = [];
  const http = (async (url: string, init?: RequestInit) => {
    calls.push({ url, auth: new Headers(init?.headers).get("Authorization") });
    const body = url.includes("/search/") ? { results: [photo] } : url.includes("/download") ? { url: "https://file" } : photo;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return { calls, unsplash: createUnsplash("KEY", http) };
}

describe("unsplash", () => {
  it("searches in English terms and keeps only what the picker shows", async () => {
    expect(searchQuery("ruộng bậc thang Sapa")).toBe("ruộng bậc thang Sapa vietnam");
    expect(searchQuery("Ha Long Vietnam")).toBe("Ha Long Vietnam");
    const { calls, unsplash } = fake();
    expect(await unsplash.search("Hạ Long")).toEqual([{ id: "abc123XYZ", thumb: photo.urls.small, alt: "boats on a bay", author: "Duc Nguyen" }]);
    expect(calls[0]!.url).toContain("orientation=landscape");
    expect(calls[0]!.auth).toBe("Client-ID KEY");
  });

  it("picking a photo counts its download once and returns a hotlinked URL with the credit (UTM)", async () => {
    const { calls, unsplash } = fake();
    const pick = await unsplash.pick("abc123XYZ");
    expect(calls.map((c) => c.url)).toEqual(["https://api.unsplash.com/photos/abc123XYZ", photo.links.download_location]);
    expect(pick.src.startsWith("https://images.unsplash.com/photo-1?")).toBe(true);
    expect(pick.src).toContain("w=1600");
    expect(pick.credit).toEqual({ name: "Duc Nguyen", url: "https://unsplash.com/@duc?utm_source=bac_viet_travel&utm_medium=referral" });
  });

  it("refuses odd ids and download links off the API host (no request is made for them)", async () => {
    const { calls, unsplash } = fake();
    await expect(unsplash.pick("../../me")).rejects.toThrow();
    expect(calls).toEqual([]);
    const evil = createUnsplash("KEY", (async () => new Response(JSON.stringify({ ...photo, links: { download_location: "https://evil.example/x" } }))) as unknown as typeof fetch);
    await expect(evil.pick("abc123XYZ")).rejects.toThrow("download link");
  });
});
