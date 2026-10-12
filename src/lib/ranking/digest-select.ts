import type { CatalogueItem, Preferences } from "@/types/domain";
import { matchesAnyGenre, matchesLanguage, onPlatforms, ruleScore } from "./signals";

export const DIGEST_MAX = 10;

/**
 * Titles for a user's digest: verified new releases only, on their platforms and languages,
 * in their content types, honouring personalisation strength. Not-interested and watched
 * titles are dropped. Ranked by AI score (rule score as tiebreak / fallback).
 */
export function selectDigestItems(items: CatalogueItem[], prefs: Preferences, excludeIds: Set<string> = new Set()): CatalogueItem[] {
  const eligible = items.filter((i) => {
    if (!i.verified) return false;
    if (excludeIds.has(i.title.id) || i.watchStatus === "not_interested" || i.watchStatus === "watched") return false;
    if (!onPlatforms(i.platforms, prefs.platforms)) return false;
    if (!matchesLanguage(i.title, prefs.languages)) return false;
    if (!prefs.contentTypes.includes(i.title.mediaType)) return false;
    const genreFit = matchesAnyGenre(i.title, prefs.genres);
    if (prefs.discoveryMode === "stick") return genreFit;
    if (prefs.discoveryMode === "balanced") return genreFit || (i.recommendation?.matchScore ?? 0) >= 70;
    return true;
  });

  const score = (i: CatalogueItem) => i.recommendation?.matchScore ?? ruleScore(i, prefs) * 0.5;
  const ranked = eligible.sort((a, b) => score(b) - score(a));
  // Recommended titles first; "skip" verdicts only fill remaining space.
  const keep = ranked.filter((i) => i.recommendation?.verdict !== "skip");
  const skips = ranked.filter((i) => i.recommendation?.verdict === "skip");
  return [...keep, ...skips].slice(0, DIGEST_MAX);
}

export function digestKey(kind: "weekly" | "preview", userId: string, periodStart: string): string {
  return `${kind}:${userId}:${periodStart}`;
}
