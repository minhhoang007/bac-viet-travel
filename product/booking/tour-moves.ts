import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { departures, discountCodes } from "../schema/booking";

/**
 * A published tour whose slug changed: its departures (and so its bookings) and its discount codes follow the new
 * slug, or the tour page shows no dates and the codes stop applying. `moves` are the content module's old → current
 * published slugs (listMoved); an old slug that a live tour uses again (`live`) belongs to that tour and is left alone.
 * Idempotent: run after every tour publish. Returns the number of rows moved.
 */
export async function followTourMoves(db: Db, moves: { from: string; to: string }[], live: ReadonlySet<string>): Promise<number> {
  const pending = moves.filter((m) => !live.has(m.from) && m.from !== m.to);
  if (!pending.length) return 0;
  return db.transaction(async (tx) => {
    let moved = 0;
    for (const { from, to } of pending) {
      moved += (await tx.update(departures).set({ tourSlug: to }).where(eq(departures.tourSlug, from)).returning({ id: departures.id })).length;
      moved += (await tx.update(discountCodes).set({ tourSlug: to }).where(eq(discountCodes.tourSlug, from)).returning({ id: discountCodes.id })).length;
    }
    return moved;
  });
}
