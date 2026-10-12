const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive window ending today (IST), `days` long. */
export function releaseWindow(days: number, now = new Date()) {
  const end = todayIST(now);
  return { start: addDays(end, -(days - 1)), end };
}

export function inWindow(date: string | null | undefined, w: { start: string; end: string }) {
  return !!date && date >= w.start && date <= w.end;
}

export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
