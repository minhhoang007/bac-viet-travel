import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";

/**
 * Manifest `mediaInUse`: an image cannot be deleted while any content (draft or live copy) still refers to it, by
 * its id (tour images: `{ mediaId }`) or by its CDN path (a URL pasted into a post). Text search over the JSON, so a
 * new content type or field is covered without listing it here.
 */
export async function mediaInUse(db: Db, id: string): Promise<boolean> {
  const [row] = await db.execute<{ used: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM content_items c, media_assets m
      WHERE m.id = ${id}
        AND (strpos(c.draft::text, m.id::text) > 0 OR strpos(coalesce(c.published::text, ''), m.id::text) > 0
          OR strpos(c.draft::text, m.public_id) > 0 OR strpos(coalesce(c.published::text, ''), m.public_id) > 0)
    ) AS used`);
  return Boolean(row?.used);
}
