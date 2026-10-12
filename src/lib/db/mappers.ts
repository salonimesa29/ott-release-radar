import type {
  AutomationRun,
  DigestRecord,
  IntegrationHealth,
  OttRelease,
  Preferences,
  Recommendation,
  Title,
} from "@/types/domain";

/* Row shapes as returned by PostgREST (snake_case). */
export type TitleRow = {
  id: string;
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string | null;
  overview: string | null;
  original_language: string;
  genre_ids: number[];
  genre_names: string[];
  networks: string[];
  poster_path: string | null;
  backdrop_path: string | null;
  runtime_minutes: number | null;
  episode_runtime_minutes: number | null;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  vote_average: number | string | null;
  vote_count: number | null;
  popularity: number | string | null;
  metadata_fingerprint: string;
  metadata_updated_at: string;
};

export type ReleaseRow = {
  id: string;
  title_id: string;
  provider_key: OttRelease["providerKey"];
  provider_id: number | null;
  provider_name: string;
  region: string;
  streaming_release_date: string | null;
  release_date_type: OttRelease["releaseDateType"];
  season_number: number;
  episode_count: number | null;
  availability_status: OttRelease["availabilityStatus"];
  source_name: string;
  source_url: string | null;
  last_verified_at: string;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

export const toTitle = (r: TitleRow): Title => ({
  id: r.id,
  tmdbId: r.tmdb_id,
  mediaType: r.media_type,
  title: r.title,
  originalTitle: r.original_title,
  overview: r.overview,
  originalLanguage: r.original_language,
  genreIds: r.genre_ids ?? [],
  genreNames: r.genre_names ?? [],
  networks: r.networks ?? [],
  posterPath: r.poster_path,
  backdropPath: r.backdrop_path,
  runtimeMinutes: r.runtime_minutes,
  episodeRuntimeMinutes: r.episode_runtime_minutes,
  numberOfSeasons: r.number_of_seasons,
  numberOfEpisodes: r.number_of_episodes,
  voteAverage: num(r.vote_average),
  voteCount: r.vote_count,
  popularity: num(r.popularity),
  metadataFingerprint: r.metadata_fingerprint,
  metadataUpdatedAt: r.metadata_updated_at,
});

export const toRelease = (r: ReleaseRow): OttRelease => ({
  id: r.id,
  titleId: r.title_id,
  providerKey: r.provider_key,
  providerId: r.provider_id,
  providerName: r.provider_name,
  region: r.region,
  streamingReleaseDate: r.streaming_release_date,
  releaseDateType: r.release_date_type,
  seasonNumber: r.season_number || null,
  episodeCount: r.episode_count,
  availabilityStatus: r.availability_status,
  sourceName: r.source_name,
  sourceUrl: r.source_url,
  lastVerifiedAt: r.last_verified_at,
});

export type PrefsRow = {
  preferred_genres: string[];
  preferred_languages: string[];
  preferred_platforms: string[];
  preferred_content_types: string[];
  preferred_runtime: string;
  dubbed_content_preference: string;
  popularity_preference: string;
  genre_exploration: string;
  discovery_mode: string;
  preferred_mood: string | null;
  use_feedback: boolean;
  digest_enabled: boolean;
  digest_day: number;
  digest_time: string;
  timezone: string;
  telegram_chat_id: number | string | null;
  telegram_username: string | null;
  telegram_connected: boolean;
};

export const toPreferences = (r: PrefsRow): Preferences =>
  ({
    genres: r.preferred_genres,
    languages: r.preferred_languages,
    platforms: r.preferred_platforms,
    contentTypes: r.preferred_content_types,
    runtime: r.preferred_runtime,
    dubbed: r.dubbed_content_preference,
    popularity: r.popularity_preference,
    genreExploration: r.genre_exploration,
    discoveryMode: r.discovery_mode,
    mood: r.preferred_mood,
    useFeedback: r.use_feedback,
    digestEnabled: r.digest_enabled,
    digestDay: r.digest_day,
    digestTime: r.digest_time.slice(0, 5),
    timezone: "Asia/Kolkata",
    telegramChatId: r.telegram_chat_id === null ? null : Number(r.telegram_chat_id),
    telegramUsername: r.telegram_username,
    telegramConnected: r.telegram_connected,
  }) as Preferences;

/** Only the user-editable columns (matches the column grant in the migration). */
export const fromPreferences = (p: Partial<Preferences>) => {
  const row: Record<string, unknown> = {};
  if (p.genres) row.preferred_genres = p.genres;
  if (p.languages) row.preferred_languages = p.languages;
  if (p.platforms) row.preferred_platforms = p.platforms;
  if (p.contentTypes) row.preferred_content_types = p.contentTypes;
  if (p.runtime) row.preferred_runtime = p.runtime;
  if (p.dubbed) row.dubbed_content_preference = p.dubbed;
  if (p.popularity) row.popularity_preference = p.popularity;
  if (p.genreExploration) row.genre_exploration = p.genreExploration;
  if (p.discoveryMode) row.discovery_mode = p.discoveryMode;
  if (p.mood !== undefined) row.preferred_mood = p.mood;
  if (p.useFeedback !== undefined) row.use_feedback = p.useFeedback;
  if (p.digestEnabled !== undefined) row.digest_enabled = p.digestEnabled;
  if (p.digestDay !== undefined) row.digest_day = p.digestDay;
  return row;
};

export type RecRow = {
  title_id: string;
  match_score: number;
  verdict: Recommendation["verdict"];
  synopsis: string;
  explanation: string;
  matched_preferences: string[];
  confidence: Recommendation["confidence"];
  model_name: string;
  generated_at: string;
  metadata_fingerprint: string;
  preference_fingerprint: string;
};

export const toRecommendation = (r: RecRow): Recommendation => ({
  titleId: r.title_id,
  matchScore: r.match_score,
  verdict: r.verdict,
  synopsis: r.synopsis,
  explanation: r.explanation,
  matchedPreferences: r.matched_preferences,
  confidence: r.confidence,
  modelName: r.model_name,
  generatedAt: r.generated_at,
});

export type DigestRow = {
  id: string;
  kind: DigestRecord["kind"];
  period_start: string;
  period_end: string;
  status: DigestRecord["status"];
  telegram_message_ids: (number | string)[];
  chunks_total: number;
  chunks_sent: number;
  title_count: number;
  recommended_count: number;
  message_preview: string | null;
  message_chunks: string[] | null;
  sent_at: string | null;
  error_message: string | null;
  idempotency_key: string;
  created_at: string;
};

export const toDigest = (r: DigestRow): DigestRecord => ({
  id: r.id,
  kind: r.kind,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  status: r.status,
  telegramMessageIds: (r.telegram_message_ids ?? []).map(Number),
  chunksTotal: r.chunks_total,
  chunksSent: r.chunks_sent,
  titleCount: r.title_count,
  recommendedCount: r.recommended_count,
  messagePreview: r.message_preview,
  messageChunks: r.message_chunks ?? [],
  sentAt: r.sent_at,
  errorMessage: r.error_message,
  idempotencyKey: r.idempotency_key,
  createdAt: r.created_at,
});

export type RunRow = {
  id: string;
  job_type: AutomationRun["jobType"];
  run_key: string;
  trigger: AutomationRun["trigger"];
  status: AutomationRun["status"];
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  records_failed: number;
  summary: Record<string, unknown> | null;
  error_summary: string | null;
};

export const toRun = (r: RunRow): AutomationRun => ({
  id: r.id,
  jobType: r.job_type,
  runKey: r.run_key,
  trigger: r.trigger,
  status: r.status,
  startedAt: r.started_at,
  completedAt: r.completed_at,
  recordsProcessed: r.records_processed,
  recordsFailed: r.records_failed,
  summary: r.summary,
  errorSummary: r.error_summary,
});

export type IntegrationRow = {
  integration_name: IntegrationHealth["name"];
  status: IntegrationHealth["status"];
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
};

export const toIntegration = (r: IntegrationRow): IntegrationHealth => ({
  name: r.integration_name,
  status: r.status,
  lastCheckedAt: r.last_checked_at,
  lastSuccessAt: r.last_success_at,
  lastErrorAt: r.last_error_at,
  lastErrorMessage: r.last_error_message,
});
