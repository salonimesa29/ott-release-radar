import "server-only";
import { GENRES } from "./constants";
import { inWindow } from "./dates";
import type { Candidate, Platform, Preferences } from "./types";

const BASE = "https://api.themoviedb.org/3";
const MAX_DETAILS = 40;

const PROVIDER_PATTERNS: Record<Platform, RegExp> = {
  Netflix: /^netflix$/i,
  "Prime Video": /^amazon prime video$/i,
  JioHotstar: /hotstar/i,
};
// Used if the provider list lookup fails.
const FALLBACK_PROVIDER_IDS: Record<Platform, number[]> = {
  Netflix: [8],
  "Prime Video": [119],
  JioHotstar: [122, 2336],
};

type Json = Record<string, unknown>;

export function hasTmdb() {
  return !!process.env.TMDB_API_KEY;
}

async function tmdb<T = Json>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY!;
  const url = new URL(BASE + path);
  const headers: Record<string, string> = { accept: "application/json" };
  // v4 read-access tokens are JWTs; v3 keys are 32-char hex.
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function providerIds(platforms: Platform[]): Promise<Map<number, Platform>> {
  const map = new Map<number, Platform>();
  try {
    const [movie, tv] = await Promise.all(
      ["movie", "tv"].map((k) =>
        tmdb<{ results: { provider_id: number; provider_name: string }[] }>(
          `/watch/providers/${k}`,
          { watch_region: "IN" },
        ),
      ),
    );
    for (const p of [...movie.results, ...tv.results]) {
      const platform = platforms.find((pl) => PROVIDER_PATTERNS[pl].test(p.provider_name));
      if (platform) map.set(p.provider_id, platform);
    }
  } catch {
    // fall through to fallback ids
  }
  for (const pl of platforms) {
    if (![...map.values()].includes(pl)) FALLBACK_PROVIDER_IDS[pl].forEach((id) => map.set(id, pl));
  }
  return map;
}

async function discover(kind: "movie" | "tv", params: Record<string, string>): Promise<number[]> {
  const ids: number[] = [];
  for (let page = 1; page <= 2; page++) {
    const data = await tmdb<{ results: { id: number }[]; total_pages: number }>(
      `/discover/${kind}`,
      { ...params, page: String(page), sort_by: "popularity.desc", include_adult: "false" },
    );
    ids.push(...data.results.map((r) => r.id));
    if (page >= data.total_pages) break;
  }
  return ids;
}

export function matchesGenres(tmdbGenres: string[], prefGenres: string[]): boolean {
  if (prefGenres.length === 0) return true;
  const wanted = new Set(prefGenres.flatMap((g) => GENRES[g] ?? [g]));
  return tmdbGenres.some((g) => wanted.has(g));
}

/**
 * New OTT releases in India inside the window, on the chosen platforms,
 * in the chosen languages, matching at least one preferred genre.
 */
export async function fetchNewReleases(
  prefs: Preferences,
  window: { start: string; end: string },
): Promise<Candidate[]> {
  const providers = await providerIds(prefs.platforms);
  const common = {
    watch_region: "IN",
    with_watch_providers: [...providers.keys()].join("|"),
    with_watch_monetization_types: "flatrate|free|ads",
    with_original_language: prefs.languages.join("|"),
  };

  const [digitalMovies, premiereMovies, newShows, airingShows] = await Promise.all([
    // India digital release date in the window
    discover("movie", { ...common, region: "IN", with_release_type: "4", "release_date.gte": window.start, "release_date.lte": window.end }),
    // Direct-to-OTT titles often only carry a primary release date
    discover("movie", { ...common, "primary_release_date.gte": window.start, "primary_release_date.lte": window.end }),
    discover("tv", { ...common, "first_air_date.gte": window.start, "first_air_date.lte": window.end }),
    discover("tv", { ...common, "air_date.gte": window.start, "air_date.lte": window.end }),
  ]);

  const movieIds = [...new Set([...digitalMovies, ...premiereMovies])];
  const tvIds = [...new Set([...newShows, ...airingShows])];
  const jobs = [
    ...movieIds.map((id) => () => movieDetails(id, providers, window)),
    ...tvIds.map((id) => () => tvDetails(id, providers, window)),
  ].slice(0, MAX_DETAILS);

  const results = await Promise.allSettled(jobs.map((j) => j()));
  return results
    .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
    .filter((c) => c.platforms.length > 0 && matchesGenres(c.genres, prefs.genres));
}

function streamingOn(details: Json, providers: Map<number, Platform>): Platform[] {
  const inData = ((details["watch/providers"] as Json)?.results as Json)?.IN as Json | undefined;
  const offers = [
    ...((inData?.flatrate as { provider_id: number }[]) ?? []),
    ...((inData?.free as { provider_id: number }[]) ?? []),
    ...((inData?.ads as { provider_id: number }[]) ?? []),
  ];
  return [...new Set(offers.flatMap((o) => (providers.has(o.provider_id) ? [providers.get(o.provider_id)!] : [])))];
}

function genreNames(details: Json): string[] {
  return ((details.genres as { name: string }[]) ?? []).map((g) => g.name);
}

async function movieDetails(id: number, providers: Map<number, Platform>, window: { start: string; end: string }): Promise<Candidate | null> {
  const d = await tmdb(`/movie/${id}`, { append_to_response: "watch/providers,release_dates" });
  const inRelease = ((d.release_dates as Json)?.results as { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[] | undefined)
    ?.find((r) => r.iso_3166_1 === "IN")
    ?.release_dates.find((r) => r.type === 4)
    ?.release_date.slice(0, 10);
  const releaseDate = inRelease ?? (d.release_date as string);
  if (!inWindow(releaseDate, window)) return null;

  return {
    tmdbId: id,
    kind: "movie",
    title: d.title as string,
    language: d.original_language as string,
    releaseDate,
    platforms: streamingOn(d, providers),
    genres: genreNames(d),
    runtimeMinutes: (d.runtime as number) || null,
    episodeCount: null,
    seasonLabel: null,
    overview: (d.overview as string) ?? "",
    posterPath: (d.poster_path as string) ?? null,
    rating: (d.vote_count as number) > 0 ? (d.vote_average as number) : null,
  };
}

async function tvDetails(id: number, providers: Map<number, Platform>, window: { start: string; end: string }): Promise<Candidate | null> {
  const d = await tmdb(`/tv/${id}`, { append_to_response: "watch/providers" });
  const seasons = ((d.seasons as { season_number: number; air_date: string | null; episode_count: number; name: string }[]) ?? [])
    .filter((s) => s.season_number > 0);
  // A brand-new show, or a new season that premiered in the window. Weekly episodes of old seasons don't count.
  const season = seasons.find((s) => inWindow(s.air_date, window));
  if (!season) return null;

  return {
    tmdbId: id,
    kind: "tv",
    title: d.name as string,
    language: d.original_language as string,
    releaseDate: season.air_date!,
    platforms: streamingOn(d, providers),
    genres: genreNames(d),
    runtimeMinutes: ((d.episode_run_time as number[]) ?? [])[0] ?? null,
    episodeCount: season.episode_count || null,
    seasonLabel: season.season_number === 1 ? "New series" : season.name,
    overview: (d.overview as string) ?? "",
    posterPath: (d.poster_path as string) ?? null,
    rating: (d.vote_count as number) > 0 ? (d.vote_average as number) : null,
  };
}
