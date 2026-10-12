import type { ProviderKey } from "@/config/providers";
import type { AvailabilityStatus, MediaType, ReleaseDateType, ReleaseWindow } from "@/types/domain";

export interface NormalizedTitle {
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
}

export interface NormalizedRelease {
  providerKey: ProviderKey;
  providerId: number | null;
  providerName: string;
  date: string;
  dateType: ReleaseDateType;
  status: AvailabilityStatus;
  seasonNumber: number | null;
  episodeCount: number | null;
  sourceName: string;
  sourceUrl: string | null;
}

export interface SourceRecord {
  title: NormalizedTitle;
  releases: NormalizedRelease[];
}

export interface SourceResult {
  records: SourceRecord[];
  /** Candidates examined, including ones rejected as ineligible. */
  examined: number;
  /** Per-title errors that didn't abort the whole fetch. */
  failures: { ref: string; error: string }[];
}

/**
 * A release data source. TMDB is the only implementation today; a licensed
 * provider feed can be added by implementing this interface.
 */
export interface ReleaseSourceAdapter {
  readonly name: string;
  fetchWindow(window: ReleaseWindow): Promise<SourceResult>;
}
