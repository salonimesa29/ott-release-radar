import { PROVIDERS, type ProviderKey } from "@/config/providers";
import { GENRES, MOODS, languageLabel, type GenreKey, type MoodKey } from "@/config/taxonomy";
import type { CatalogueItem, Confidence, MediaType, Preferences, Title } from "@/types/domain";

/** TMDB genre IDs that represent a preference genre for a given media type. */
export function genreIdsFor(key: GenreKey, media: MediaType): number[] {
  return GENRES[key][media];
}

export function matchedGenreKeys(title: Pick<Title, "genreIds" | "mediaType">, keys: GenreKey[]): GenreKey[] {
  return keys.filter((k) => genreIdsFor(k, title.mediaType).some((id) => title.genreIds.includes(id)));
}

export function matchesAnyGenre(title: Pick<Title, "genreIds" | "mediaType">, keys: GenreKey[]): boolean {
  return keys.length === 0 || matchedGenreKeys(title, keys).length > 0;
}

export function matchesLanguage(title: Pick<Title, "originalLanguage">, languages: string[]): boolean {
  return languages.length === 0 || languages.includes(title.originalLanguage);
}

export function onPlatforms(platforms: ProviderKey[], wanted: ProviderKey[]): boolean {
  return wanted.length === 0 || platforms.some((p) => wanted.includes(p));
}

export type Alignment = "strong" | "partial" | "none" | "unknown";

export interface MatchSignals {
  genre: { level: Alignment; matched: string[] };
  language: { level: "exact" | "none"; label: string };
  platform: { level: "verified" | "unverified"; labels: string[] };
  mood: { level: "compatible" | "neutral" | "unknown" | "not_set"; label: string | null };
  confidence: Confidence;
}

/** Deterministic, explainable signals for "Why this matches you". Never claims a match on missing data. */
export function matchSignals(item: CatalogueItem, prefs: Pick<Preferences, "genres" | "languages" | "platforms">, mood: MoodKey | null): MatchSignals {
  const t = item.title;
  const matched = matchedGenreKeys(t, prefs.genres);
  const genreLevel: Alignment = !t.genreIds.length
    ? "unknown"
    : matched.length >= 2 || (matched.length === 1 && prefs.genres.length === 1)
      ? "strong"
      : matched.length === 1
        ? "partial"
        : "none";

  const moodDef = mood ? MOODS.find((m) => m.key === mood) : null;
  let moodLevel: MatchSignals["mood"]["level"] = "not_set";
  if (moodDef) {
    if (!t.genreIds.length) moodLevel = "unknown";
    else if (moodDef.genres.length === 0) moodLevel = "neutral";
    else moodLevel = moodDef.genres.some((g) => (t.genreIds as number[]).includes(g)) ? "compatible" : "neutral";
  }

  return {
    genre: { level: genreLevel, matched: matched.map((k) => GENRES[k].label) },
    language: {
      level: prefs.languages.includes(t.originalLanguage) ? "exact" : "none",
      label: languageLabel(t.originalLanguage),
    },
    platform: {
      level: item.verified ? "verified" : "unverified",
      labels: item.platforms.filter((p) => prefs.platforms.includes(p)).map((p) => PROVIDERS[p].shortLabel),
    },
    mood: { level: moodLevel, label: moodDef?.label ?? null },
    confidence: metadataConfidence(t),
  };
}

/** How complete the underlying metadata is — caps the AI's stated confidence. */
export function metadataConfidence(t: Pick<Title, "overview" | "genreIds" | "runtimeMinutes" | "episodeRuntimeMinutes" | "numberOfEpisodes" | "mediaType">): Confidence {
  const hasOverview = (t.overview?.length ?? 0) >= 80;
  const hasGenres = t.genreIds.length > 0;
  const hasLength = t.mediaType === "movie" ? !!t.runtimeMinutes : !!(t.episodeRuntimeMinutes || t.numberOfEpisodes);
  if (hasOverview && hasGenres && hasLength) return "high";
  if ((t.overview?.length ?? 0) > 0 && hasGenres) return "medium";
  return "low";
}

const CONF_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
export function minConfidence(a: Confidence, b: Confidence): Confidence {
  return CONF_RANK[a] <= CONF_RANK[b] ? a : b;
}

/**
 * Transparent hidden-gem heuristic: fewer than 250 TMDB votes AND popularity below the
 * median of the current eligible set. Titles with no vote data are not called gems.
 */
export function hiddenGemIds(items: CatalogueItem[]): Set<string> {
  const pops = items.map((i) => i.title.popularity).filter((p): p is number => p !== null).sort((a, b) => a - b);
  if (!pops.length) return new Set();
  const median = pops[Math.floor(pops.length / 2)];
  return new Set(
    items
      .filter((i) => i.title.voteCount !== null && i.title.voteCount < 250 && i.title.popularity !== null && i.title.popularity < median)
      .map((i) => i.title.id),
  );
}

/** Rule-based preference score used only when no AI score exists (never shown as an AI score). */
export function ruleScore(item: CatalogueItem, prefs: Pick<Preferences, "genres" | "languages">): number {
  const g = matchedGenreKeys(item.title, prefs.genres).length;
  return Math.min(100, g * 30 + (prefs.languages.includes(item.title.originalLanguage) ? 25 : 0) + (item.verified ? 15 : 0));
}
