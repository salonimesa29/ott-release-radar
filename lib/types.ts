export type Platform = "Netflix" | "Prime Video" | "JioHotstar";
export type Verdict = "watch" | "skip";

export interface Preferences {
  genres: string[];
  languages: string[]; // ISO 639-1 codes
  platforms: Platform[];
  windowDays: number;
  telegramChatId: string | null;
}

export interface Candidate {
  tmdbId: number;
  kind: "movie" | "tv";
  title: string;
  language: string;
  releaseDate: string;
  platforms: Platform[];
  genres: string[];
  runtimeMinutes: number | null;
  episodeCount: number | null;
  seasonLabel: string | null;
  overview: string;
  posterPath: string | null;
  rating: number | null;
}

export interface DigestItem extends Candidate {
  synopsis: string;
  verdict: Verdict;
  score: number;
  reason: string;
}

export interface Digest {
  id: string;
  createdAt: string;
  windowStart: string;
  windowEnd: string;
  source: "tmdb" | "sample";
  items: DigestItem[];
  sent: boolean;
  sentAt: string | null;
  telegramError: string | null;
}
