// Demo only: fills the media library (Cloudinary) with landscape photos of northern Vietnam from Unsplash, so staff
// trying the tour editor have good photos to pick. Each photo keeps its author: product/tours/library-credits.json
// (shown on /credits). Unsplash License: free to use; the API's download endpoint is called for every photo.
// Idempotent per database: photos already in that library ("unsplash-<id>.jpg") are skipped; credits are not duplicated.
// Usage (dry run first, then --apply):
//   node --env-file=.env.local --import ./scripts/ts-alias.mjs scripts/import-unsplash-media.ts --as admin@example.com
//   ... --apply
// Needs DATABASE_URL, UNSPLASH_ACCESS_KEY and the three CLOUDINARY_* keys.
import { readFileSync, writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { mediaConfig } from "@/config/media";
import { createLogger } from "@/core/logger";
import { users } from "@/core/users/schema";
import { createDb } from "@/db/client";
import { createMediaModule } from "@/modules/media";
import { cloudinaryProvider } from "@/providers/media/cloudinary";
import { photoCredits } from "@/product/tours/credits";

const TOPICS = [
  { query: "ha long bay vietnam", vi: "Vịnh Hạ Long" },
  { query: "ninh binh vietnam", vi: "Ninh Bình" },
  { query: "sapa vietnam rice terraces", vi: "Sapa" },
  { query: "ha giang vietnam", vi: "Hà Giang" },
  { query: "cat ba vietnam", vi: "Cát Bà" },
  { query: "mai chau vietnam", vi: "Mai Châu" },
  { query: "mu cang chai", vi: "Mù Cang Chải" },
  { query: "hanoi old quarter", vi: "Hà Nội" },
];
// Unsplash demo apps get 50 API calls an hour: 8 searches + one download call per photo stays under it.
const PER_TOPIC = 3;
const CREDITS_FILE = "product/tours/library-credits.json";

type Credit = { id: string; author: string; username: string; topic: string };
type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  alt_description: string | null;
  user: { name: string; username: string };
  links: { download_location: string };
};

const args = process.argv.slice(2);
const email = args[args.indexOf("--as") + 1]?.trim().toLowerCase();
const apply = args.includes("--apply");
const { DATABASE_URL: url, UNSPLASH_ACCESS_KEY: key, CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = process.env;
if (!url || !email || !args.includes("--as") || !key || !cloudName || !apiKey || !apiSecret) {
  console.error("Usage: node --env-file=.env.local --import ./scripts/ts-alias.mjs scripts/import-unsplash-media.ts --as <admin email> [--apply]");
  console.error("Needs DATABASE_URL, UNSPLASH_ACCESS_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.");
  process.exit(1);
}

const unsplash = async (path: string) => {
  const res = await fetch(`https://api.unsplash.com${path}`, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
  if (!res.ok) throw new Error(`Unsplash ${res.status} on ${path.split("?")[0]}`);
  return res.json();
};

const credits: Credit[] = JSON.parse(readFileSync(CREDITS_FILE, "utf8"));

const { db, close } = createDb(url, { max: 1 });
try {
  const [actor] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email));
  if (!actor || actor.role !== "admin") throw new Error(`${email} must be an existing admin.`);
  const media = createMediaModule({ db, logger: createLogger({ write: () => {} }), config: mediaConfig, provider: cloudinaryProvider({ cloudName, apiKey, apiSecret }) });
  // Already in this library, or already a site photo (public/tours).
  const inLibrary = (await media.list({ query: "unsplash-", pageSize: 500 })).rows.map((a) => /^unsplash-(.+).jpg$/.exec(a.name)?.[1]).filter((id): id is string => Boolean(id));
  const known = new Set([...inLibrary, ...photoCredits.map((p) => p.photo)]);

  let added = 0;
  for (const topic of TOPICS) {
    const { results } = (await unsplash(`/search/photos?query=${encodeURIComponent(topic.query)}&orientation=landscape&per_page=20&content_filter=high`)) as { results: UnsplashPhoto[] };
    // Large enough for a full-width hero, not already on the site or in the library.
    const picks = results.filter((p) => !known.has(p.id) && p.width >= 2400).slice(0, PER_TOPIC);
    for (const p of picks) {
      const en = p.alt_description ? p.alt_description.charAt(0).toUpperCase() + p.alt_description.slice(1) : topic.query;
      known.add(p.id); // a photo found under two topics is used once
      if (!apply) {
        console.log(`would add  ${topic.vi.padEnd(14)} ${p.id}  by ${p.user.name}`);
        continue;
      }
      // Unsplash: count the download, and get the file URL from it.
      const { url: fileUrl } = (await unsplash(new URL(p.links.download_location).pathname + new URL(p.links.download_location).search)) as { url: string };
      const file = await (await fetch(`${fileUrl}&w=2400&fm=jpg&q=85`)).blob();
      const signed = await media.requestUpload(actor, { name: `unsplash-${p.id}.jpg` });
      const body = new FormData();
      for (const [k, v] of Object.entries(signed.fields)) body.append(k, v);
      body.append("file", file, `unsplash-${p.id}.jpg`);
      const upload = await fetch(signed.url, { method: "POST", body });
      if (!upload.ok) throw new Error(`Cloudinary upload ${upload.status} for ${p.id}`);
      const asset = await media.confirmUpload(signed.id);
      await media.update(asset.id, { alt: { vi: `${topic.vi}: ${en}`, en } });
      if (!credits.some((c) => c.id === p.id)) credits.push({ id: p.id, author: p.user.name, username: p.user.username, topic: topic.vi });
      writeFileSync(CREDITS_FILE, `${JSON.stringify(credits, null, 2)}\n`); // after each photo: a failure keeps the earlier ones credited
      added++;
      console.log(`added      ${topic.vi.padEnd(14)} ${p.id}  by ${p.user.name}`);
    }
  }
  console.log(apply ? `Done: ${added} photos added to the library.` : "Dry run: nothing uploaded. Add --apply.");
} finally {
  await close();
}
