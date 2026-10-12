import type { ProviderKey } from "@/config/providers";
import type { DiscoveryMode, GenreKey, MoodKey, WatchStatus } from "@/config/taxonomy";

export type MediaType = "movie" | "tv";
export type Verdict = "watch" | "maybe" | "skip";
export type Confidence = "high" | "medium" | "low";

export type ReleaseDateType =
  | "in_digital_release" // TMDB India "Digital" release date (type 4)
  | "series_premiere" // first season premiere of a show whose original network is the platform
  | "season_premiere" // new season premiere of such a show
  | "global_digital_release" // digital release elsewhere; India OTT date unknown
  | "primary_release"; // generic first release (may be theatrical)

export type AvailabilityStatus = "verified" | "unverified_date";

export interface ReleaseWindow {
  start: string; // YYYY-MM-DD, Asia/Kolkata
  end: string;
}

export interface Title {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  originalLanguage: string;
  genreIds: number[];
  genreNames: string[];
  networks: string[];
  posterPath: string | null;
  backdropPath: string | null;
  runtimeMinutes: number | null;
  episodeRuntimeMinutes: number | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  voteAverage: number | null;
  voteCount: number | null;
  popularity: number | null;
  metadataFingerprint: string;
  metadataUpdatedAt: string;
}

export interface OttRelease {
  id: string;
  titleId: string;
  providerKey: ProviderKey;
  providerId: number | null;
  providerName: string;
  region: string;
  streamingReleaseDate: string | null;
  releaseDateType: ReleaseDateType;
  seasonNumber: number | null;
  episodeCount: number | null;
  availabilityStatus: AvailabilityStatus;
  sourceName: string;
  sourceUrl: string | null;
  lastVerifiedAt: string;
}

export interface Recommendation {
  titleId: string;
  matchScore: number;
  verdict: Verdict;
  synopsis: string;
  explanation: string;
  matchedPreferences: string[];
  confidence: Confidence;
  modelName: string;
  generatedAt: string;
}

/** A title plus its release events in the current window, as shown in the catalogue. */
export interface CatalogueItem {
  title: Title;
  releases: OttRelease[];
  /** Earliest release in the window; verified releases take precedence. */
  primaryRelease: OttRelease;
  verified: boolean;
  platforms: ProviderKey[];
  recommendation: Recommendation | null;
  watchStatus: WatchStatus | null;
}

export interface Preferences {
  genres: GenreKey[];
  languages: string[];
  platforms: ProviderKey[];
  contentTypes: MediaType[];
  runtime: "any" | "under_60" | "under_120" | "over_120";
  dubbed: "original_only" | "dubbed_ok" | "no_preference";
  popularity: "popular" | "balanced" | "hidden_gems";
  genreExploration: "familiar" | "open";
  discoveryMode: DiscoveryMode;
  mood: MoodKey | null;
  useFeedback: boolean;
  digestEnabled: boolean;
  digestDay: number;
  digestTime: string;
  timezone: "Asia/Kolkata";
  telegramChatId: number | null;
  telegramUsername: string | null;
  telegramConnected: boolean;
}

export interface WatchlistEntry {
  titleId: string;
  status: WatchStatus;
  addedAt: string;
  updatedAt: string;
}

export type DigestKind = "preview" | "test" | "weekly";
export type DigestStatus = "preview" | "pending" | "sent" | "partial" | "failed" | "skipped";

export interface DigestRecord {
  id: string;
  kind: DigestKind;
  periodStart: string;
  periodEnd: string;
  status: DigestStatus;
  telegramMessageIds: number[];
  chunksTotal: number;
  chunksSent: number;
  titleCount: number;
  recommendedCount: number;
  messagePreview: string | null;
  messageChunks: string[];
  sentAt: string | null;
  errorMessage: string | null;
  idempotencyKey: string;
  createdAt: string;
}

export type IntegrationName = "supabase" | "tmdb" | "gemini" | "telegram";
export interface IntegrationHealth {
  name: IntegrationName;
  status: "ok" | "error" | "unconfigured" | "unknown";
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
}

export interface AutomationRun {
  id: string;
  jobType: "release_refresh" | "weekly_digest";
  runKey: string;
  trigger: "cron" | "manual";
  status: "running" | "succeeded" | "partial" | "failed" | "skipped";
  startedAt: string;
  completedAt: string | null;
  recordsProcessed: number;
  recordsFailed: number;
  summary: Record<string, unknown> | null;
  errorSummary: string | null;
}
