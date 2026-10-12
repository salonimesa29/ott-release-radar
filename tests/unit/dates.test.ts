import { describe, expect, it } from "vitest";
import { addDays, inWindow, istDate, istWeekday, nextCronRun, releaseWindow } from "@/lib/dates/ist";
import { DIGEST_CRON, nextDigestRun } from "@/lib/schedule";

describe("seven-day release window", () => {
  it("is inclusive [today-6, today] in IST", () => {
    const w = releaseWindow(new Date("2026-10-12T06:00:00Z"));
    expect(w).toEqual({ start: "2026-10-06", end: "2026-10-12" });
    expect(addDays(w.start, 6)).toBe(w.end);
  });

  it("includes both boundary dates and excludes the days just outside", () => {
    const w = releaseWindow(new Date("2026-10-12T06:00:00Z"));
    expect(inWindow("2026-10-06", w)).toBe(true);
    expect(inWindow("2026-10-12", w)).toBe(true);
    expect(inWindow("2026-10-05", w)).toBe(false);
    expect(inWindow("2026-10-13", w)).toBe(false);
  });

  it("rejects missing or malformed dates", () => {
    const w = releaseWindow(new Date("2026-10-12T06:00:00Z"));
    expect(inWindow(null, w)).toBe(false);
    expect(inWindow(undefined, w)).toBe(false);
    expect(inWindow("", w)).toBe(false);
    expect(inWindow("2026-10-10T00:00:00Z", w)).toBe(false);
  });

  it("crosses month boundaries correctly", () => {
    expect(releaseWindow(new Date("2026-03-03T06:00:00Z"))).toEqual({ start: "2026-02-25", end: "2026-03-03" });
  });

  it("supports a custom window length", () => {
    expect(releaseWindow(new Date("2026-10-12T06:00:00Z"), 1)).toEqual({ start: "2026-10-12", end: "2026-10-12" });
  });
});

describe("Asia/Kolkata date handling", () => {
  it("rolls over to the next IST day at 18:30 UTC", () => {
    expect(istDate(new Date("2026-10-15T20:00:00Z"))).toBe("2026-10-16");
    expect(istDate(new Date("2026-10-15T18:29:59Z"))).toBe("2026-10-15");
    expect(istDate(new Date("2026-10-15T18:30:00Z"))).toBe("2026-10-16");
  });

  it("moves the release window at IST midnight, not UTC midnight", () => {
    expect(releaseWindow(new Date("2026-10-11T19:00:00Z")).end).toBe("2026-10-12");
    expect(releaseWindow(new Date("2026-10-11T18:00:00Z")).end).toBe("2026-10-11");
  });

  it("istWeekday uses the IST calendar day", () => {
    const t = new Date("2026-10-15T20:00:00Z"); // Thursday in UTC, Friday 01:30 in IST
    expect(t.getUTCDay()).toBe(4);
    expect(istWeekday(t)).toBe(5);
  });

  it("nextCronRun finds the next daily 12:30 UTC firing", () => {
    expect(nextCronRun("30 12 * * *", new Date("2026-10-12T10:00:00Z"))?.toISOString()).toBe("2026-10-12T12:30:00.000Z");
    // Exactly at the firing time: the next one is tomorrow (strictly after now).
    expect(nextCronRun("30 12 * * *", new Date("2026-10-12T12:30:00Z"))?.toISOString()).toBe("2026-10-13T12:30:00.000Z");
    expect(nextCronRun("30 12 * * *", new Date("2026-10-12T13:00:00Z"))?.toISOString()).toBe("2026-10-13T12:30:00.000Z");
  });

  it("nextCronRun honours a day-of-week field and rejects unsupported expressions", () => {
    // 2026-10-12 is a Monday; day 5 = Friday.
    expect(nextCronRun("0 9 * * 5", new Date("2026-10-12T10:00:00Z"))?.toISOString()).toBe("2026-10-16T09:00:00.000Z");
    expect(nextCronRun("*/5 * * * *", new Date())).toBeNull();
    expect(nextCronRun("30 12 1 * *", new Date())).toBeNull();
  });

  it("the digest cron is the daily 12:30 UTC (18:00 IST) schedule", () => {
    expect(DIGEST_CRON).toBe("30 12 * * *");
  });

  it("nextDigestRun for Friday lands on a Friday at 12:30 UTC (18:00 IST)", () => {
    const run = nextDigestRun(5, new Date("2026-10-12T10:00:00Z"));
    expect(run?.toISOString()).toBe("2026-10-16T12:30:00.000Z");
    expect(run!.getUTCDay()).toBe(5);
    expect(istWeekday(run!)).toBe(5);
  });

  it("nextDigestRun on the digest day after the run time moves to the following week", () => {
    expect(nextDigestRun(5, new Date("2026-10-16T13:00:00Z"))?.toISOString()).toBe("2026-10-23T12:30:00.000Z");
  });
});
