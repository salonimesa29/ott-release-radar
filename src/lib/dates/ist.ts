import type { ReleaseWindow } from "@/types/domain";

export const TIMEZONE = "Asia/Kolkata";
export const WINDOW_DAYS = 7;
const IST_OFFSET_MS = 330 * 60 * 1000; // India has no DST.

/** The calendar date in India for an instant, as YYYY-MM-DD. */
export function istDate(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Day of week in India (0 = Sunday). */
export function istWeekday(now: Date = new Date()): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The preceding seven days in India, inclusive of today: [today-6, today]. */
export function releaseWindow(now: Date = new Date(), days = WINDOW_DAYS): ReleaseWindow {
  const end = istDate(now);
  return { start: addDays(end, -(days - 1)), end };
}

export function inWindow(date: string | null | undefined, w: ReleaseWindow): boolean {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= w.start && date <= w.end;
}

/** "October 6 – October 12" (or "October 6 – 12" within one month). */
export function formatWindow(w: ReleaseWindow): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });
  const sameMonth = w.start.slice(0, 7) === w.end.slice(0, 7);
  const start = fmt(w.start, { month: "long", day: "numeric" });
  const end = sameMonth ? fmt(w.end, { day: "numeric" }) : fmt(w.end, { month: "long", day: "numeric" });
  return `${start} – ${end}`;
}

export function formatDay(date: string, withYear = false): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

/**
 * Next run of a simple UTC cron expression "M H * * D" or "M H * * *".
 * Returns null for expressions it can't reliably interpret.
 */
export function nextCronRun(expr: string, now: Date = new Date()): Date | null {
  const m = expr.trim().match(/^(\d{1,2}) (\d{1,2}) \* \* (\*|[0-6])$/);
  if (!m) return null;
  const [minute, hour] = [Number(m[1]), Number(m[2])];
  const dow = m[3] === "*" ? null : Number(m[3]);
  for (let i = 0; i <= 7; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i, hour, minute));
    if (d > now && (dow === null || d.getUTCDay() === dow)) return d;
  }
  return null;
}
