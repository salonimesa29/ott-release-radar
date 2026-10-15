import { describe, expect, it } from "vitest";
import { upsertTitles } from "@/lib/db/catalogue";
import type { NormalizedTitle } from "@/lib/release/types";

const title = (tmdbId: number, fp: string): NormalizedTitle => ({
  tmdbId, mediaType: "movie", title: `T${tmdbId}`, originalTitle: null, overview: null, originalLanguage: "hi",
  genreIds: [53], genreNames: ["Thriller"], networks: [], posterPath: null, backdropPath: null, runtimeMinutes: 100,
  episodeRuntimeMinutes: null, numberOfSeasons: null, numberOfEpisodes: null, voteAverage: null, voteCount: 0,
  popularity: 1, metadataFingerprint: fp,
});

/** Minimal fake: first call = select existing, second = upsert (captures rows). */
function fakeDb(existing: Record<string, unknown>[]) {
  const captured: Record<string, unknown>[][] = [];
  let call = 0;
  const builder = {
    select: () => (call === 0 ? builder : Promise.resolve({ data: captured[0].map((r, i) => ({ id: `id${i}`, tmdb_id: r.tmdb_id, media_type: r.media_type })), error: null })),
    in: () => { call++; return Promise.resolve({ data: existing, error: null }); },
    upsert: (rows: Record<string, unknown>[]) => { captured.push(rows); return builder; },
  };
  return { db: { from: () => builder } as never, captured };
}

describe("upsertTitles", () => {
  it("sends metadata_updated_at on every row, keeping the old value for unchanged titles", async () => {
    const old = "2026-10-12T12:28:54.000Z";
    const { db, captured } = fakeDb([{ tmdb_id: 1, media_type: "movie", metadata_fingerprint: "same", metadata_updated_at: old }]);
    const res = await upsertTitles(db, [title(1, "same"), title(2, "new")]);
    const rows = captured[0];
    expect(rows.every((r) => typeof r.metadata_updated_at === "string")).toBe(true);
    expect(rows[0].metadata_updated_at).toBe(old);
    expect(rows[1].metadata_updated_at).not.toBe(old);
    expect(res.changed).toBe(1);
    // All rows share one column set (PostgREST bulk-upsert requirement).
    expect(new Set(rows.map((r) => Object.keys(r).sort().join(","))).size).toBe(1);
  });
});
