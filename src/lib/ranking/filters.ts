import type { ProviderKey } from "@/config/providers";
import type { GenreKey, MoodKey } from "@/config/taxonomy";
import type { CatalogueItem, Verdict } from "@/types/domain";
import { hiddenGemIds, matchesAnyGenre, matchesLanguage, onPlatforms, ruleScore } from "./signals";

export type QuickFilter = "all" | "best" | "movies" | "series";
export type WatchTime = "any" | "under_30" | "under_60" | "under_90" | "movie_night" | "binge" | "surprise";
export type SortKey = "newest" | "match" | "title" | "runtime";

export interface DiscoveryFilters {
  platforms: ProviderKey[];
  genres: GenreKey[];
  languages: string[];
  quick: QuickFilter;
  watchTime: WatchTime;
  mood: MoodKey | null;
  hiddenGems: boolean;
  verifiedOnly: boolean;
  verdict: Verdict | "any";
  search: string;
  sort: SortKey;
}

export const WATCH_TIME_OPTIONS: { key: WatchTime; label: string }[] = [
  { key: "any", label: "Any length" },
  { key: "under_30", label: "Under 30 minutes" },
  { key: "under_60", label: "Under 60 minutes" },
  { key: "under_90", label: "Under 90 minutes" },
  { key: "movie_night", label: "Movie night: 90+ minutes" },
  { key: "binge", label: "Binge-worthy series" },
  { key: "surprise", label: "Surprise me" },
];

const LIMITS: Partial<Record<WatchTime, number>> = { under_30: 30, under_60: 60, under_90: 90 };

/**
 * Viewing-time fit. For series, "under N minutes" means one episode fits tonight (episode
 * runtime), never the whole season. Unknown durations return "unknown" so the UI can say so.
 */
export function fitsWatchTime(item: CatalogueItem, wt: WatchTime): "yes" | "no" | "unknown" {
  const t = item.title;
  if (wt === "any" || wt === "surprise") return "yes";
  if (wt === "movie_night") {
    if (t.mediaType !== "movie") return "no";
    return t.runtimeMinutes ? (t.runtimeMinutes >= 90 ? "yes" : "no") : "unknown";
  }
  if (wt === "binge") {
    if (t.mediaType !== "tv") return "no";
    const eps = item.primaryRelease.episodeCount ?? t.numberOfEpisodes;
    return eps ? (eps >= 4 ? "yes" : "no") : "unknown";
  }
  const limit = LIMITS[wt]!;
  const minutes = t.mediaType === "movie" ? t.runtimeMinutes : t.episodeRuntimeMinutes;
  return minutes ? (minutes <= limit ? "yes" : "no") : "unknown";
}

export function releaseDate(item: CatalogueItem): string {
  return item.primaryRelease.streamingReleaseDate ?? "";
}

export function applyFilters(items: CatalogueItem[], f: DiscoveryFilters) {
  const gems = f.hiddenGems ? hiddenGemIds(items) : null;
  const q = f.search.trim().toLowerCase();
  let unknownDuration = 0;

  const out = items.filter((i) => {
    if (f.verifiedOnly && !i.verified) return false;
    if (!onPlatforms(i.platforms, f.platforms)) return false;
    if (!matchesLanguage(i.title, f.languages)) return false;
    if (!matchesAnyGenre(i.title, f.genres)) return false;
    if (f.quick === "movies" && i.title.mediaType !== "movie") return false;
    if (f.quick === "series" && i.title.mediaType !== "tv") return false;
    if (f.verdict !== "any" && i.recommendation?.verdict !== f.verdict) return false;
    if (gems && !gems.has(i.title.id)) return false;
    if (q && !`${i.title.title} ${i.title.originalTitle ?? ""}`.toLowerCase().includes(q)) return false;
    const fit = fitsWatchTime(i, f.watchTime);
    if (fit === "unknown") unknownDuration++;
    return fit === "yes";
  });

  return { items: sortItems(out, f.quick === "best" ? "match" : f.sort, f), unknownDuration };
}

export function sortItems(items: CatalogueItem[], sort: SortKey, f: Pick<DiscoveryFilters, "genres" | "languages">): CatalogueItem[] {
  const copy = [...items];
  const byDate = (a: CatalogueItem, b: CatalogueItem) => releaseDate(b).localeCompare(releaseDate(a));
  switch (sort) {
    case "match":
      // AI-scored first by score; unscored after, by rule-based fit.
      return copy.sort((a, b) => {
        const sa = a.recommendation?.matchScore ?? -1;
        const sb = b.recommendation?.matchScore ?? -1;
        if (sa !== sb) return sb - sa;
        return ruleScore(b, f) - ruleScore(a, f) || byDate(a, b);
      });
    case "title":
      return copy.sort((a, b) => a.title.title.localeCompare(b.title.title));
    case "runtime": {
      const len = (i: CatalogueItem) => (i.title.mediaType === "movie" ? i.title.runtimeMinutes : i.title.episodeRuntimeMinutes) ?? Infinity;
      return copy.sort((a, b) => len(a) - len(b));
    }
    default:
      return copy.sort((a, b) => Number(b.verified) - Number(a.verified) || byDate(a, b));
  }
}

/**
 * Weighted random pick from actual results: weight = AI score (or rule score) squared,
 * so strong matches are favoured but not guaranteed. `rand` is injectable for tests.
 */
export function weightedPick(items: CatalogueItem[], f: Pick<DiscoveryFilters, "genres" | "languages">, rand = Math.random): CatalogueItem | null {
  const pool = items.filter((i) => i.recommendation?.verdict !== "skip" && i.watchStatus !== "not_interested");
  const source = pool.length ? pool : items;
  if (!source.length) return null;
  const weights = source.map((i) => Math.max(1, i.recommendation?.matchScore ?? ruleScore(i, f)) ** 2);
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < source.length; i++) {
    r -= weights[i];
    if (r <= 0) return source[i];
  }
  return source[source.length - 1];
}

export function discoveryStats(items: CatalogueItem[], prefs: { genres: GenreKey[]; languages: string[] }, watchlistCount: number) {
  const verified = items.filter((i) => i.verified);
  return {
    eligible: verified.length,
    unverified: items.length - verified.length,
    genreMatches: verified.filter((i) => prefs.genres.length > 0 && matchesAnyGenre(i.title, prefs.genres)).length,
    languageMatches: verified.filter((i) => prefs.languages.length > 0 && matchesLanguage(i.title, prefs.languages)).length,
    strongMatches: verified.filter((i) => (i.recommendation?.matchScore ?? 0) >= 75).length,
    scored: items.filter((i) => i.recommendation).length,
    watchlist: watchlistCount,
  };
}
