// Demo departures for the next 8 weeks. Idempotent (skips existing tour+date).
// Usage: node --env-file=.env.local scripts/seed-departures.ts   (add --demo-full to pre-fill two dates per tour)
import { randomInt } from "node:crypto";
import { readdirSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

// Weekdays (0 = Sunday) per destination; Sapa trips leave on Fridays.
const SCHEDULE: Record<string, { days: number[]; capacity: number }> = {
  "ha-long": { days: [2, 4, 6], capacity: 16 },
  "ninh-binh": { days: [1, 3, 5, 6, 0], capacity: 16 },
  sapa: { days: [5], capacity: 12 },
};
const WEEKS = 8;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = () => `BV-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const slugs = readdirSync("content/tours/vi").filter((f) => f.endsWith(".mdx")).map((f) => f.replace(/\.mdx$/, ""));
  const today = new Date(Date.now() + 7 * 3_600_000); // Vietnam date
  let added = 0;
  for (const slug of slugs) {
    const destination = Object.keys(SCHEDULE).find((d) => slug.startsWith(d));
    if (!destination) continue;
    const { days, capacity } = SCHEDULE[destination]!;
    const dates: string[] = [];
    for (let i = 1; i <= WEEKS * 7; i++) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i));
      if (days.includes(d.getUTCDay())) dates.push(d.toISOString().slice(0, 10));
    }
    const rows = await sql`
      insert into departures (tour_slug, date, capacity)
      select ${slug}, d::date, ${capacity} from unnest(${dates}::text[]) as d
      on conflict (tour_slug, date) do nothing
      returning id, date, capacity`;
    added += rows.length;

    if (process.argv.includes("--demo-full") && rows.length >= 4) {
      // The 3rd date shows "only 3 left", the 4th "sold out" (earlier dates stay open for testing).
      const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      for (const [d, seats] of [[sorted[2]!, sorted[2]!.capacity - 3], [sorted[3]!, sorted[3]!.capacity]] as const) {
        await sql`
          insert into bookings (code, token_hash, departure_id, status, hold_expires_at, name, email, phone, locale, adults, seats, unit_price_vnd, total_vnd, deposit_vnd)
          values (${code()}, 'demo', ${d.id}, 'confirmed', now(), 'Demo group', 'demo@example.com', '0900000000', 'vi', ${seats}, ${seats}, 0, 0, 0)`;
      }
    }
  }
  console.log(`departures added: ${added}`);
} finally {
  await sql.end();
}
