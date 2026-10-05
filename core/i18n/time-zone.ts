/** "2026-10-06T08:00" (an <input type="datetime-local"> value) read as wall-clock time in `timeZone`. */
export function zonedToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!);
  // The zone's offset at that moment: how the same instant reads on the zone's clock, minus UTC.
  const offset = wallClock(new Date(asUtc), timeZone) - asUtc;
  return new Date(asUtc - offset);
}

/** A date as an <input type="datetime-local"> value in `timeZone`. */
export function utcToZoned(date: Date, timeZone: string): string {
  return new Date(wallClock(date, timeZone)).toISOString().slice(0, 16);
}

function wallClock(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
}
