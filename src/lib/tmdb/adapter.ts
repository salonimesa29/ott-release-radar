import "server-only";
import { PROVIDER_LIST } from "@/config/providers";
import { fingerprint } from "@/lib/fingerprint";
import { mapLimit } from "@/lib/http";
import {
  classifyMovie,
  classifyTv,
  dedupeReleases,
  targetProviders,
  type IndiaProviders,
  type MovieReleaseDates,
  type TvSeason,
} from "@/lib/release/eligibility";
import type {
  NormalizedRelease,
  NormalizedTitle,
  ReleaseSourceAdapter,
  SourceRecord,
  SourceResult,
} from "@/lib/release/types";
import type { ReleaseWindow } from "@/types/domain";
import { tmdbGet } from "./client";

const MAX_DETAILS = 160;
const CONCURRENCY = 6;

type Discover = { results: { id: number }[]; total_pages: number };
type Genre = { id: number; name: string };
type WatchProviders = { "watch/providers"?: { results?: { IN?: IndiaProviders } } };

type MovieDetails = WatchProviders & {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  original_language: string;
  genres: Genre[];
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number | null;
  release_date: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  release_dates?: MovieReleaseDates;
};

type TvDetails = WatchProviders & {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  original_language: string;
  genres: Genre[];
  networks: { id: number; name: string }[];
  poster_path: string | null;
  backdrop_path: string | null;
  episode_run_time: number[];
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  seasons: TvSeason[];
  vote_average: number;
  vote_count: number;
  popularity: number;
};

export class TmdbReleaseAdapter implements ReleaseSourceAdapter {
  readonly name = "tmdb";

  constructor(private readonly options: { languages?: string[] } = {}) {}

  async fetchWindow(w: ReleaseWindow): Promise<SourceResult> {
    const providerIds = PROVIDER_LIST.flatMap((p) => p.providerIds).join("|");
    const base = {
      watch_region: "IN",
      with_watch_providers: providerIds,
      with_watch_monetization_types: "flatrate|free|ads",
      include_adult: "false",
      sort_by: "popularity.desc",
    };
    // A general pass plus a pass restricted to users' languages, so regional titles aren't
    // crowded out by globally popular ones.
    const langs = this.options.languages?.length ? this.options.languages.join("|") : undefined;
    const passes = [undefined, langs].filter((l, i, a) => i === 0 || (l && l !== a[0]));

    const movieQueries = passes.flatMap((lang) => [
      { region: "IN", with_release_type: "4", "release_date.gte": w.start, "release_date.lte": w.end, with_original_language: lang },
      { "primary_release_date.gte": w.start, "primary_release_date.lte": w.end, with_original_language: lang },
    ]);
    const tvQueries = passes.flatMap((lang) => [
      { "air_date.gte": w.start, "air_date.lte": w.end, with_original_language: lang },
      { "first_air_date.gte": w.start, "first_air_date.lte": w.end, with_original_language: lang },
    ]);

    const [movieIds, tvIds] = await Promise.all([
      this.collect("movie", movieQueries.map((q) => ({ ...base, ...q }))),
      this.collect("tv", tvQueries.map((q) => ({ ...base, ...q }))),
    ]);

    const candidates = [
      ...[...movieIds].map((id) => ({ kind: "movie" as const, id })),
      ...[...tvIds].map((id) => ({ kind: "tv" as const, id })),
    ].slice(0, MAX_DETAILS);

    const settled = await mapLimit(candidates, CONCURRENCY, (c) =>
      c.kind === "movie" ? this.movie(c.id, w) : this.tv(c.id, w),
    );

    const records: SourceRecord[] = [];
    const failures: SourceResult["failures"] = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") {
        if (r.value) records.push(r.value);
      } else {
        failures.push({ ref: `${candidates[i].kind}:${candidates[i].id}`, error: String(r.reason?.message ?? r.reason) });
      }
    });
    return { records, examined: candidates.length, failures };
  }

  private async collect(kind: "movie" | "tv", queries: Record<string, string | undefined>[]): Promise<Set<number>> {
    const ids = new Set<number>();
    for (const q of queries) {
      for (let page = 1; page <= 5; page++) {
        const data = await tmdbGet<Discover>(`/discover/${kind}`, { ...q, page });
        data.results.forEach((r) => ids.add(r.id));
        if (page >= data.total_pages) break;
      }
    }
    return ids;
  }

  private async movie(id: number, w: ReleaseWindow): Promise<SourceRecord | null> {
    const d = await tmdbGet<MovieDetails>(`/movie/${id}`, { append_to_response: "watch/providers,release_dates" });
    const india = d["watch/providers"]?.results?.IN;
    const offers = targetProviders(india);
    if (!offers.length) return null;
    const event = classifyMovie(d.release_dates, d.release_date, w);
    if (!event) return null;

    const releases: NormalizedRelease[] = offers.map(({ key, offer }) => ({
      providerKey: key,
      providerId: offer.provider_id,
      providerName: offer.provider_name,
      date: event.date,
      dateType: event.type,
      status: event.verified ? "verified" : "unverified_date",
      seasonNumber: null,
      episodeCount: null,
      sourceName: "tmdb",
      sourceUrl: india?.link ?? null,
    }));

    return {
      title: normalize({
        tmdbId: d.id,
        mediaType: "movie",
        title: d.title,
        originalTitle: d.original_title,
        overview: d.overview,
        originalLanguage: d.original_language,
        genres: d.genres,
        networks: [],
        posterPath: d.poster_path,
        backdropPath: d.backdrop_path,
        runtimeMinutes: d.runtime || null,
        episodeRuntimeMinutes: null,
        numberOfSeasons: null,
        numberOfEpisodes: null,
        voteAverage: d.vote_count > 0 ? d.vote_average : null,
        voteCount: d.vote_count,
        popularity: d.popularity,
      }),
      releases: dedupeReleases(releases),
    };
  }

  private async tv(id: number, w: ReleaseWindow): Promise<SourceRecord | null> {
    const d = await tmdbGet<TvDetails>(`/tv/${id}`, { append_to_response: "watch/providers" });
    const india = d["watch/providers"]?.results?.IN;
    const offers = targetProviders(india);
    if (!offers.length) return null;

    const releases: NormalizedRelease[] = [];
    for (const { key, offer } of offers) {
      const event = classifyTv(d.seasons ?? [], d.networks ?? [], key, w);
      if (!event) continue;
      releases.push({
        providerKey: key,
        providerId: offer.provider_id,
        providerName: offer.provider_name,
        date: event.date,
        dateType: event.type,
        status: event.verified ? "verified" : "unverified_date",
        seasonNumber: event.seasonNumber,
        episodeCount: event.episodeCount,
        sourceName: "tmdb",
        sourceUrl: india?.link ?? null,
      });
    }
    if (!releases.length) return null;

    return {
      title: normalize({
        tmdbId: d.id,
        mediaType: "tv",
        title: d.name,
        originalTitle: d.original_name,
        overview: d.overview,
        originalLanguage: d.original_language,
        genres: d.genres,
        networks: (d.networks ?? []).map((n) => n.name),
        posterPath: d.poster_path,
        backdropPath: d.backdrop_path,
        runtimeMinutes: null,
        episodeRuntimeMinutes: d.episode_run_time?.[0] || null,
        numberOfSeasons: d.number_of_seasons,
        numberOfEpisodes: d.number_of_episodes,
        voteAverage: d.vote_count > 0 ? d.vote_average : null,
        voteCount: d.vote_count,
        popularity: d.popularity,
      }),
      releases: dedupeReleases(releases),
    };
  }
}

function normalize(t: Omit<NormalizedTitle, "genreIds" | "genreNames" | "metadataFingerprint"> & { genres: Genre[] }): NormalizedTitle {
  const { genres, ...rest } = t;
  const clean = {
    ...rest,
    title: rest.title.trim(),
    originalTitle: rest.originalTitle && rest.originalTitle !== rest.title ? rest.originalTitle.trim() : null,
    overview: rest.overview?.trim() || null,
    originalLanguage: rest.originalLanguage.toLowerCase().slice(0, 2),
    genreIds: (genres ?? []).map((g) => g.id),
    genreNames: (genres ?? []).map((g) => g.name),
  };
  // Popularity/votes drift daily; leave them out so AI recommendations aren't regenerated for noise.
  const { popularity: _p, voteCount: _c, voteAverage: _a, ...stable } = clean;
  void _p; void _c; void _a;
  return { ...clean, metadataFingerprint: fingerprint(stable) };
}
