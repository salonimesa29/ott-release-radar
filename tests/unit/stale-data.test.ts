import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const users = vi.hoisted(() => ({ getRecommendations: vi.fn(), listWatchlist: vi.fn() }));
vi.mock("@/lib/db/users", () => users);

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RunRow } from "@/lib/db/mappers";
import { startRun } from "@/lib/db/ops";
import { fingerprint } from "@/lib/fingerprint";
import { decorate, preferenceFingerprint, primaryRelease, toCatalogueItem } from "@/services/catalogue.service";
import { callsOf, fakeSupabase, makeItem, makePreferences, makeRecommendation, makeRelease, makeTitle } from "../fixtures";

const NOW = new Date("2026-10-12T12:30:00Z");
const DUP = { error: { message: "duplicate key value violates unique constraint", code: "23505" } };

const runRow = (o: Partial<RunRow> = {}): RunRow => ({
  id: "run-1",
  job_type: "weekly_digest",
  run_key: "weekly_digest:2026-10-12",
  trigger: "cron",
  status: "running",
  started_at: NOW.toISOString(),
  completed_at: null,
  records_processed: 0,
  records_failed: 0,
  summary: null,
  error_summary: null,
  ...o,
});
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe("stale-data behaviour: automation runs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a new run when the key is free", async () => {
    const { client, queries } = fakeSupabase([{ data: runRow() }]);
    const run = await startRun(client, "weekly_digest", "weekly_digest:2026-10-12", "cron");
    expect(run?.id).toBe("run-1");
    expect(callsOf(queries[0], "insert")[0][0]).toMatchObject({ run_key: "weekly_digest:2026-10-12", status: "running" });
  });

  it("does not start a duplicate when the existing run succeeded", async () => {
    const { client, queries } = fakeSupabase([DUP, { data: runRow({ status: "succeeded", completed_at: minutesAgo(5) }) }]);
    expect(await startRun(client, "weekly_digest", "weekly_digest:2026-10-12", "cron")).toBeNull();
    expect(queries).toHaveLength(2); // no update attempted
  });

  it("does not steal a run that is still fresh", async () => {
    const { client, queries } = fakeSupabase([DUP, { data: runRow({ status: "running", started_at: minutesAgo(2) }) }]);
    expect(await startRun(client, "weekly_digest", "weekly_digest:2026-10-12", "cron")).toBeNull();
    expect(queries).toHaveLength(2);
  });

  it("reclaims a stale running run (started 20 minutes ago)", async () => {
    const { client, queries } = fakeSupabase([
      DUP,
      { data: runRow({ status: "running", started_at: minutesAgo(20) }) },
      { data: runRow({ status: "running", trigger: "manual", started_at: NOW.toISOString() }) },
    ]);
    const run = await startRun(client, "weekly_digest", "weekly_digest:2026-10-12", "manual");
    expect(run?.status).toBe("running");
    const update = queries[2];
    expect(callsOf(update, "update")[0][0]).toMatchObject({ status: "running", trigger: "manual", completed_at: null });
    // Compare-and-set: only reclaim if the row is still in the state we observed.
    expect(callsOf(update, "eq")).toEqual([
      ["id", "run-1"],
      ["status", "running"],
    ]);
  });

  it("reclaims a failed run for retry", async () => {
    const { client, queries } = fakeSupabase([DUP, { data: runRow({ status: "failed", completed_at: minutesAgo(1) }) }, { data: runRow() }]);
    expect(await startRun(client, "weekly_digest", "weekly_digest:2026-10-12", "cron")).not.toBeNull();
    expect(callsOf(queries[2], "eq")).toContainEqual(["status", "failed"]);
  });

  it("returns null when another worker reclaimed it first", async () => {
    const { client } = fakeSupabase([DUP, { data: runRow({ status: "failed" }) }, { data: null }]);
    expect(await startRun(client, "weekly_digest", "weekly_digest:2026-10-12", "cron")).toBeNull();
  });

  it("throws on non-conflict database errors", async () => {
    const { client } = fakeSupabase([{ error: { message: "timeout", code: "57014" } }]);
    await expect(startRun(client, "weekly_digest", "k", "cron")).rejects.toThrow("starting run");
  });
});

describe("stale-data behaviour: fingerprints", () => {
  it("fingerprint is stable regardless of key order and changes with values", () => {
    expect(fingerprint({ a: 1, b: [1, 2], c: { d: null } })).toBe(fingerprint({ c: { d: null }, b: [1, 2], a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
    expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
    expect(fingerprint({ a: 1 })).toMatch(/^[0-9a-f]{24}$/);
  });

  it("preferenceFingerprint changes when genres change but not when their order changes", () => {
    const base = makePreferences({ genres: ["thriller", "comedy"] });
    expect(preferenceFingerprint(base, null)).toBe(preferenceFingerprint({ ...base, genres: ["comedy", "thriller"] }, null));
    expect(preferenceFingerprint(base, null)).not.toBe(preferenceFingerprint({ ...base, genres: ["thriller"] }, null));
  });

  it("preferenceFingerprint reflects mood and ignores non-recommendation fields", () => {
    const base = makePreferences();
    expect(preferenceFingerprint(base, "feel_good")).not.toBe(preferenceFingerprint(base, null));
    expect(preferenceFingerprint(base, "feel_good")).toBe(preferenceFingerprint({ ...base, mood: "feel_good" }, null));
    expect(preferenceFingerprint(base, null)).toBe(preferenceFingerprint({ ...base, telegramChatId: 42, digestDay: 1, digestEnabled: false }, null));
  });
});

describe("stale-data behaviour: cached recommendations", () => {
  beforeEach(() => {
    users.getRecommendations.mockReset();
    users.listWatchlist.mockReset();
  });

  it("reuses a recommendation only when its metadata fingerprint matches the title", async () => {
    const fresh = makeItem({ title: { metadataFingerprint: "meta-v2" } });
    const stale = makeItem({ title: { metadataFingerprint: "meta-v2" } });
    const recs = new Map([
      [fresh.title.id, { ...makeRecommendation({ titleId: fresh.title.id }), metadataFingerprint: "meta-v2" }],
      [stale.title.id, { ...makeRecommendation({ titleId: stale.title.id }), metadataFingerprint: "meta-v1" }],
    ]);
    users.getRecommendations.mockResolvedValue(recs);
    users.listWatchlist.mockResolvedValue([
      { titleId: fresh.title.id, status: "want_to_watch", addedAt: "", updatedAt: "" },
      { titleId: stale.title.id, status: "not_interested", addedAt: "", updatedAt: "" },
    ]);

    const db = {} as SupabaseClient;
    const prefs = makePreferences();
    const out = await decorate(db, "user-1", [fresh, stale], prefs, "feel_good");

    expect(users.getRecommendations).toHaveBeenCalledWith(db, "user-1", preferenceFingerprint(prefs, "feel_good"), [fresh.title.id, stale.title.id]);
    expect(users.listWatchlist).toHaveBeenCalledWith(db, "user-1");
    expect(out.items[0].recommendation?.matchScore).toBe(80);
    expect(out.items[0].recommendation).not.toHaveProperty("metadataFingerprint", "meta-v2");
    expect(out.items[1].recommendation).toBeNull();
    expect(out.items.map((i) => i.watchStatus)).toEqual(["want_to_watch", "not_interested"]);
    expect(out.watchlistCount).toBe(1); // not-interested entries aren't counted
  });

  it("handles no cached recommendations and an empty watchlist", async () => {
    users.getRecommendations.mockResolvedValue(new Map());
    users.listWatchlist.mockResolvedValue([]);
    const out = await decorate({} as SupabaseClient, "user-1", [makeItem()], makePreferences(), null);
    expect(out.items[0].recommendation).toBeNull();
    expect(out.items[0].watchStatus).toBeNull();
    expect(out.watchlistCount).toBe(0);
  });

  it("primaryRelease prefers verified releases, then the earliest date", () => {
    const unverifiedEarly = makeRelease({ availabilityStatus: "unverified_date", streamingReleaseDate: "2026-10-06" });
    const verifiedLate = makeRelease({ availabilityStatus: "verified", streamingReleaseDate: "2026-10-11" });
    const verifiedEarly = makeRelease({ availabilityStatus: "verified", streamingReleaseDate: "2026-10-08" });
    expect(primaryRelease([unverifiedEarly, verifiedLate, verifiedEarly])).toBe(verifiedEarly);
    expect(primaryRelease([unverifiedEarly])).toBe(unverifiedEarly);
  });

  it("toCatalogueItem derives verified flag and de-duplicated platforms", () => {
    const title = makeTitle();
    const releases = [
      makeRelease({ titleId: title.id, providerKey: "netflix", availabilityStatus: "unverified_date" }),
      makeRelease({ titleId: title.id, providerKey: "netflix", releaseDateType: "global_digital_release", availabilityStatus: "unverified_date" }),
      makeRelease({ titleId: title.id, providerKey: "hotstar", availabilityStatus: "unverified_date" }),
    ];
    const item = toCatalogueItem(title, releases);
    expect(item.verified).toBe(false);
    expect(item.platforms).toEqual(["netflix", "hotstar"]);
    expect(item.recommendation).toBeNull();
    expect(item.watchStatus).toBeNull();
  });
});
