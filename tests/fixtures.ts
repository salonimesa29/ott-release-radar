/**
 * TEST FIXTURES ONLY — synthetic objects for unit tests. None of these titles, IDs or
 * dates are real catalogue data and nothing here is used by the application.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogueItem, OttRelease, Preferences, Recommendation, Title } from "@/types/domain";

let seq = 0;
/** Deterministic fake UUID (valid v4 shape) so tests never depend on randomness. */
export function fakeUuid(n = ++seq): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

export function makeTitle(overrides: Partial<Title> = {}): Title {
  return {
    id: fakeUuid(),
    tmdbId: 900000 + seq,
    mediaType: "movie",
    title: "Fixture Movie",
    originalTitle: null,
    overview: "A fixture overview that is long enough to count as a complete synopsis for the metadata check.",
    originalLanguage: "hi",
    genreIds: [53],
    genreNames: ["Thriller"],
    networks: [],
    posterPath: null,
    backdropPath: null,
    runtimeMinutes: 120,
    episodeRuntimeMinutes: null,
    numberOfSeasons: null,
    numberOfEpisodes: null,
    voteAverage: 7,
    voteCount: 500,
    popularity: 50,
    metadataFingerprint: "meta-fp-1",
    metadataUpdatedAt: "2026-10-10T00:00:00.000Z",
    ...overrides,
  };
}

export function makeRelease(overrides: Partial<OttRelease> = {}): OttRelease {
  return {
    id: fakeUuid(),
    titleId: overrides.titleId ?? fakeUuid(),
    providerKey: "netflix",
    providerId: 8,
    providerName: "Netflix",
    region: "IN",
    streamingReleaseDate: "2026-10-10",
    releaseDateType: "in_digital_release",
    seasonNumber: null,
    episodeCount: null,
    availabilityStatus: "verified",
    sourceName: "tmdb",
    sourceUrl: "https://www.themoviedb.org/movie/1/watch?locale=IN",
    lastVerifiedAt: "2026-10-12T00:00:00.000Z",
    ...overrides,
  };
}

export function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    titleId: overrides.titleId ?? fakeUuid(),
    matchScore: 80,
    verdict: "watch",
    synopsis: "A fixture synopsis. It has two sentences.",
    explanation: "You like thrillers and this is one.",
    matchedPreferences: ["Thriller"],
    confidence: "high",
    modelName: "fixture-model",
    generatedAt: "2026-10-12T00:00:00.000Z",
    ...overrides,
  };
}

/** A catalogue item. Pass `title`/`release` overrides; derived fields follow unless overridden. */
export function makeItem(
  opts: {
    title?: Partial<Title>;
    release?: Partial<OttRelease>;
    recommendation?: Partial<Recommendation> | null;
  } & Partial<Omit<CatalogueItem, "title" | "recommendation">> = {},
): CatalogueItem {
  const title = makeTitle(opts.title);
  const release = makeRelease({ titleId: title.id, ...opts.release });
  const releases = opts.releases ?? [release];
  return {
    title,
    releases,
    primaryRelease: opts.primaryRelease ?? releases[0],
    verified: opts.verified ?? releases.some((r) => r.availabilityStatus === "verified"),
    platforms: opts.platforms ?? [...new Set(releases.map((r) => r.providerKey))],
    recommendation: opts.recommendation ? makeRecommendation({ titleId: title.id, ...opts.recommendation }) : null,
    watchStatus: opts.watchStatus ?? null,
  };
}

export function makePreferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    genres: ["thriller"],
    languages: ["hi", "en"],
    platforms: ["netflix", "prime_video", "hotstar"],
    contentTypes: ["movie", "tv"],
    runtime: "any",
    dubbed: "no_preference",
    popularity: "balanced",
    genreExploration: "familiar",
    discoveryMode: "balanced",
    mood: null,
    useFeedback: true,
    digestEnabled: true,
    digestDay: 5,
    digestTime: "18:00",
    timezone: "Asia/Kolkata",
    telegramChatId: null,
    telegramUsername: null,
    telegramConnected: false,
    ...overrides,
  };
}

/* ---------- Fake Supabase query builder ---------- */

export type FakeResult = { data?: unknown; error?: { message: string; code?: string } | null };
export interface RecordedQuery {
  table: string;
  calls: [method: string, ...args: unknown[]][];
}

/**
 * Hand-rolled stand-in for the Supabase client. Every `from(table)` starts a chainable query
 * that records each method call and, when awaited, resolves to the next queued result.
 */
export function fakeSupabase(results: FakeResult[] = []) {
  const queue = [...results];
  const queries: RecordedQuery[] = [];

  function from(table: string) {
    const q: RecordedQuery = { table, calls: [] };
    queries.push(q);
    const result = queue.shift() ?? { data: null, error: null };
    const resolved = { data: result.data ?? null, error: result.error ?? null };
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "insert", "upsert", "update", "delete", "eq", "neq", "in", "is", "not", "gt", "order", "limit", "single", "maybeSingle"]) {
      builder[m] = (...args: unknown[]) => {
        q.calls.push([m, ...args]);
        return builder;
      };
    }
    builder.then = (onFulfilled: (v: typeof resolved) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected);
    return builder;
  }

  return { client: { from } as unknown as SupabaseClient, queries };
}

/** Calls of one method across a recorded query. */
export function callsOf(q: RecordedQuery, method: string): unknown[][] {
  return q.calls.filter(([m]) => m === method).map(([, ...args]) => args);
}
