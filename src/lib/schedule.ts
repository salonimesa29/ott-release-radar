import vercel from "../../vercel.json";
import { WEEKDAYS } from "@/config/taxonomy";
import { istWeekday, nextCronRun, TIMEZONE } from "@/lib/dates/ist";

/** The single source of truth for schedules is vercel.json; this reads it. */
export const DIGEST_CRON = vercel.crons.find((c) => c.path === "/api/cron/weekly-digest")!.schedule;
export const REFRESH_CRON = vercel.crons.find((c) => c.path === "/api/cron/refresh")!.schedule;

/**
 * Next time this user's digest will be attempted: the next digest-cron firing that falls on
 * their digest day in Asia/Kolkata. Null if the cron expression can't be interpreted.
 */
export function nextDigestRun(digestDay: number, now = new Date()): Date | null {
  let cursor = now;
  for (let i = 0; i < 8; i++) {
    const next = nextCronRun(DIGEST_CRON, cursor);
    if (!next) return null;
    if (istWeekday(next) === digestDay) return next;
    cursor = new Date(next.getTime() + 60_000);
  }
  return null;
}

export function formatRun(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TIMEZONE }) + " IST";
}

export function digestScheduleLabel(digestDay: number): string {
  return `${WEEKDAYS[digestDay]}s at 6:00 PM IST`;
}
