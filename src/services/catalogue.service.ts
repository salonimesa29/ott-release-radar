import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MoodKey } from "@/config/taxonomy";
import { releaseWindow } from "@/lib/dates/ist";
import { getTitleWithReleases, getTitlesWithReleases, listReleasesInWindow } from "@/lib/db/catalogue";
import { lastSuccessfulRun, latestRuns } from "@/lib/db/ops";
import { getRecommendations, listWatchlist } from "@/lib/db/users";
import { fingerprint } from "@/lib/fingerprint";
import { isVerified } from "@/lib/release/eligibility";
import type { CatalogueItem, OttRelease, Preferences, ReleaseWindow, Title } from "@/types/domain";

/** Preference fields that change what Gemini would say. Changing any of them invalidates cached recommendations. */
export function preferenceFingerprint(prefs: Preferences, mood: MoodKey | null): string {
  return fingerprint({
    genres: [...prefs.genres].sort(),
    languages: [...prefs.languages].sort(),
    platforms: [...prefs.platforms].sort(),
    contentTypes: [...prefs.contentTypes].sort(),
    runtime: prefs.runtime,
    dubbed: prefs.dubbed,
    popularity: prefs.popularity,
    genreExploration: prefs.genreExploration,
    discoveryMode: prefs.discoveryMode,
    mood: mood ?? prefs.mood,
  });
}

/** Pick the release that represents a title: verified first, then earliest in the window. */
export function primaryRelease(releases: OttRelease[]): OttRelease {
  return [...releases].sort(
    (a, b) =>
      Number(b.availabilityStatus === "verified") - Number(a.availabilityStatus === "verified") ||
      (a.streamingReleaseDate ?? "").localeCompare(b.streamingReleaseDate ?? ""),
  )[0];
}

export function toCatalogueItem(title: Title, releases: OttRelease[]): CatalogueItem {
  return {
    title,
    releases,
    primaryRelease: primaryRelease(releases),
    verified: isVerified(releases),
    platforms: [...new Set(releases.map((r) => r.providerKey))],
    recommendation: null,
    watchStatus: null,
  };
}

/** Attach cached recommendations (only if still valid for current metadata) and watchlist status. */
export async function decorate(db: SupabaseClient, userId: string, items: CatalogueItem[], prefs: Preferences, mood: MoodKey | null) {
  const [recs, watchlist] = await Promise.all([
    getRecommendations(db, userId, preferenceFingerprint(prefs, mood), items.map((i) => i.title.id)),
    listWatchlist(db, userId),
  ]);
  const status = new Map(watchlist.map((w) => [w.titleId, w.status]));
  return {
    items: items.map((i) => {
      const rec = recs.get(i.title.id);
      const fresh = rec && rec.metadataFingerprint === i.title.metadataFingerprint;
      return {
        ...i,
        recommendation: fresh ? { ...rec, metadataFingerprint: undefined } : null,
        watchStatus: status.get(i.title.id) ?? null,
      } as CatalogueItem;
    }),
    watchlistCount: watchlist.filter((w) => w.status !== "not_interested").length,
  };
}

export interface CatalogueResult {
  window: ReleaseWindow;
  items: CatalogueItem[];
  watchlistCount: number;
  lastSyncedAt: string | null;
  lastRefresh: { status: string; at: string; error: string | null } | null;
}

/** This week's releases for a user. Reads only — never calls TMDB or Gemini. */
export async function getCatalogue(db: SupabaseClient, userId: string, prefs: Preferences, mood: MoodKey | null = null, now = new Date()): Promise<CatalogueResult> {
  const window = releaseWindow(now);
  const [grouped, lastOk, recent] = await Promise.all([
    listReleasesInWindow(db, window),
    lastSuccessfulRun(db, "release_refresh"),
    latestRuns(db, "release_refresh", 1),
  ]);
  const base = grouped.map((g) => toCatalogueItem(g.title, g.releases.filter((r) => r.region === "IN")));
  const { items, watchlistCount } = await decorate(db, userId, base, prefs, mood);
  const last = recent[0];
  return {
    window,
    items,
    watchlistCount,
    lastSyncedAt: lastOk?.completedAt ?? null,
    lastRefresh: last ? { status: last.status, at: last.completedAt ?? last.startedAt, error: last.errorSummary } : null,
  };
}

export async function getTitleDetail(db: SupabaseClient, userId: string, titleId: string, prefs: Preferences) {
  const found = await getTitleWithReleases(db, titleId);
  if (!found || !found.releases.length) return found ? { title: found.title, item: null } : null;
  const { items } = await decorate(db, userId, [toCatalogueItem(found.title, found.releases)], prefs, null);
  return { title: found.title, item: items[0] };
}

/** Watchlist titles with their (possibly older) releases. Works from the database only. */
export async function getWatchlistItems(db: SupabaseClient, userId: string, prefs: Preferences) {
  const entries = await listWatchlist(db, userId);
  const titles = await getTitlesWithReleases(db, entries.map((e) => e.titleId));
  const base = titles.filter((t) => t.releases.length).map((t) => toCatalogueItem(t.title, t.releases));
  const { items } = await decorate(db, userId, base, prefs, null);
  const order = new Map(entries.map((e, i) => [e.titleId, i]));
  return items.sort((a, b) => (order.get(a.title.id) ?? 0) - (order.get(b.title.id) ?? 0));
}
