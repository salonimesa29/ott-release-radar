import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedRelease, NormalizedTitle } from "@/lib/release/types";
import type { OttRelease, ReleaseWindow, Title } from "@/types/domain";
import { toRelease, toTitle, type ReleaseRow, type TitleRow } from "./mappers";

const TITLE_COLS =
  "id,tmdb_id,media_type,title,original_title,overview,original_language,genre_ids,genre_names,networks,poster_path,backdrop_path,runtime_minutes,episode_runtime_minutes,number_of_seasons,number_of_episodes,vote_average,vote_count,popularity,metadata_fingerprint,metadata_updated_at";
const RELEASE_COLS =
  "id,title_id,provider_key,provider_id,provider_name,region,streaming_release_date,release_date_type,season_number,episode_count,availability_status,source_name,source_url,last_verified_at";

function fail(error: { message: string } | null, what: string) {
  if (error) throw new Error(`Database error while ${what}: ${error.message}`);
}

/**
 * Upsert titles by (tmdb_id, media_type). Returns id per "type:tmdbId" key and how many
 * titles had their metadata change (fingerprint differs) or are new.
 */
export async function upsertTitles(db: SupabaseClient, titles: NormalizedTitle[]) {
  if (!titles.length) return { ids: new Map<string, string>(), changed: 0 };
  const key = (t: { media_type: string; tmdb_id: number }) => `${t.media_type}:${t.tmdb_id}`;

  const { data: existing, error: readErr } = await db
    .from("titles")
    .select("tmdb_id,media_type,metadata_fingerprint,metadata_updated_at")
    .in("tmdb_id", titles.map((t) => t.tmdbId));
  fail(readErr, "reading titles");
  const before = new Map((existing ?? []).map((r) => [key(r), r.metadata_fingerprint as string]));
  const updatedAt = new Map((existing ?? []).map((r) => [key(r), r.metadata_updated_at as string]));

  const now = new Date().toISOString();
  const rows = titles.map((t) => ({
    tmdb_id: t.tmdbId,
    media_type: t.mediaType,
    title: t.title,
    original_title: t.originalTitle,
    overview: t.overview,
    original_language: t.originalLanguage,
    genre_ids: t.genreIds,
    genre_names: t.genreNames,
    networks: t.networks,
    poster_path: t.posterPath,
    backdrop_path: t.backdropPath,
    runtime_minutes: t.runtimeMinutes,
    episode_runtime_minutes: t.episodeRuntimeMinutes,
    number_of_seasons: t.numberOfSeasons,
    number_of_episodes: t.numberOfEpisodes,
    vote_average: t.voteAverage,
    vote_count: t.voteCount,
    popularity: t.popularity,
    metadata_fingerprint: t.metadataFingerprint,
    // Every row must carry the same columns: in a bulk upsert PostgREST sends NULL for a key
    // missing from some rows, which breaks the NOT NULL constraint. Keep the old timestamp when
    // metadata is unchanged.
    metadata_updated_at:
      before.get(`${t.mediaType}:${t.tmdbId}`) === t.metadataFingerprint
        ? updatedAt.get(`${t.mediaType}:${t.tmdbId}`) ?? now
        : now,
  }));

  const { data, error } = await db
    .from("titles")
    .upsert(rows, { onConflict: "tmdb_id,media_type" })
    .select("id,tmdb_id,media_type");
  fail(error, "saving titles");

  const changed = titles.filter((t) => before.get(`${t.mediaType}:${t.tmdbId}`) !== t.metadataFingerprint).length;
  return { ids: new Map((data ?? []).map((r) => [key(r), r.id as string])), changed };
}

/** Upsert release events. Unique on (title, provider, region, date type, season). first_seen_at is preserved. */
export async function upsertReleases(db: SupabaseClient, releases: (NormalizedRelease & { titleId: string })[]) {
  if (!releases.length) return 0;
  const now = new Date().toISOString();
  const rows = releases.map((r) => ({
    title_id: r.titleId,
    provider_key: r.providerKey,
    provider_id: r.providerId,
    provider_name: r.providerName,
    region: "IN",
    streaming_release_date: r.date,
    release_date_type: r.dateType,
    season_number: r.seasonNumber ?? 0,
    episode_count: r.episodeCount,
    availability_status: r.status,
    source_name: r.sourceName,
    source_url: r.sourceUrl,
    last_verified_at: now,
  }));
  const { error } = await db
    .from("ott_releases")
    .upsert(rows, { onConflict: "title_id,provider_key,region,release_date_type,season_number" });
  fail(error, "saving releases");
  return rows.length;
}

type JoinedRow = ReleaseRow & { titles: TitleRow };

function group(rows: JoinedRow[]): { title: Title; releases: OttRelease[] }[] {
  const byTitle = new Map<string, { title: Title; releases: OttRelease[] }>();
  for (const row of rows) {
    const entry = byTitle.get(row.title_id) ?? { title: toTitle(row.titles), releases: [] };
    entry.releases.push(toRelease(row));
    byTitle.set(row.title_id, entry);
  }
  return [...byTitle.values()];
}

/** All release events dated inside the window, grouped by title. */
export async function listReleasesInWindow(db: SupabaseClient, w: ReleaseWindow) {
  const { data, error } = await db
    .from("ott_releases")
    .select(`${RELEASE_COLS},titles!inner(${TITLE_COLS})`)
    .eq("region", "IN")
    .gte("streaming_release_date", w.start)
    .lte("streaming_release_date", w.end)
    .order("streaming_release_date", { ascending: false })
    .limit(1000);
  fail(error, "loading releases");
  return group((data ?? []) as unknown as JoinedRow[]);
}

export async function getTitleWithReleases(db: SupabaseClient, titleId: string) {
  const { data, error } = await db
    .from("titles")
    .select(`${TITLE_COLS},ott_releases(${RELEASE_COLS})`)
    .eq("id", titleId)
    .maybeSingle();
  fail(error, "loading title");
  if (!data) return null;
  const row = data as unknown as TitleRow & { ott_releases: ReleaseRow[] };
  return { title: toTitle(row), releases: row.ott_releases.map(toRelease) };
}

export async function getTitlesWithReleases(db: SupabaseClient, ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await db
    .from("titles")
    .select(`${TITLE_COLS},ott_releases(${RELEASE_COLS})`)
    .in("id", ids);
  fail(error, "loading titles");
  return ((data ?? []) as unknown as (TitleRow & { ott_releases: ReleaseRow[] })[]).map((row) => ({
    title: toTitle(row),
    releases: row.ott_releases.map(toRelease),
  }));
}

/** Title search across the stored catalogue (any date). */
export async function searchTitles(db: SupabaseClient, query: string, limit = 20) {
  const q = query.replace(/[%_,()]/g, " ").trim();
  if (q.length < 2) return [];
  const { data, error } = await db
    .from("titles")
    .select(`${TITLE_COLS},ott_releases(${RELEASE_COLS})`)
    .or(`title.ilike.%${q}%,original_title.ilike.%${q}%`)
    .order("popularity", { ascending: false, nullsFirst: false })
    .limit(limit);
  fail(error, "searching titles");
  return ((data ?? []) as unknown as (TitleRow & { ott_releases: ReleaseRow[] })[]).map((row) => ({
    title: toTitle(row),
    releases: row.ott_releases.map(toRelease),
  }));
}
