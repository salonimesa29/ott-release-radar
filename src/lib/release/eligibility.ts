/**
 * Release-date rules. Pure functions — no I/O — so they can be unit tested.
 *
 * What TMDB can and cannot tell us:
 *  - Watch providers (JustWatch data) say where a title streams in India *now*, with no date.
 *  - Movie release_dates include per-country types; type 4 = Digital. An India type-4 date is
 *    the closest TMDB signal to "became available on Indian OTT".
 *  - TV seasons have air dates. For shows whose original network IS the streaming platform
 *    (e.g. a Netflix original), a season air date is the streaming premiere.
 *
 * Verified:   India digital date in window (+ provider listed), or season/series premiere in
 *             window for a show originally on that platform (+ provider listed).
 * Unverified: global digital / primary release dates in window while listed on a provider in
 *             India. Shown with a label, excluded from verified counts and digests.
 * Excluded:   theatrical-only dates, ongoing weekly episodes of an older season.
 */
import { resolveNetwork, resolveProvider, type ProviderKey } from "@/config/providers";
import { inWindow } from "@/lib/dates/ist";
import type { ReleaseDateType, ReleaseWindow } from "@/types/domain";
import type { NormalizedRelease } from "./types";

export interface ProviderOffer {
  provider_id: number;
  provider_name: string;
}

export interface IndiaProviders {
  link?: string;
  flatrate?: ProviderOffer[];
  free?: ProviderOffer[];
  ads?: ProviderOffer[];
}

/** Subscription/free/ads offers on target platforms in India, de-duplicated by platform. */
export function targetProviders(india: IndiaProviders | undefined): { key: ProviderKey; offer: ProviderOffer }[] {
  if (!india) return [];
  const seen = new Map<ProviderKey, ProviderOffer>();
  for (const offer of [...(india.flatrate ?? []), ...(india.free ?? []), ...(india.ads ?? [])]) {
    const key = resolveProvider(offer);
    if (key && !seen.has(key)) seen.set(key, offer);
  }
  return [...seen.entries()].map(([key, offer]) => ({ key, offer }));
}

export interface MovieReleaseDates {
  results: { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[];
}

const day = (iso: string) => iso.slice(0, 10);

/** Pick the strongest movie release event inside the window, or null if none qualifies. */
export function classifyMovie(
  dates: MovieReleaseDates | undefined,
  primaryReleaseDate: string | null,
  w: ReleaseWindow,
): { date: string; type: ReleaseDateType; verified: boolean } | null {
  const all = dates?.results ?? [];
  const india = all.find((r) => r.iso_3166_1 === "IN")?.release_dates ?? [];

  const inDigital = india.filter((r) => r.type === 4).map((r) => day(r.release_date)).sort();
  const inDigitalInWindow = inDigital.find((d) => inWindow(d, w));
  if (inDigitalInWindow) return { date: inDigitalInWindow, type: "in_digital_release", verified: true };
  // India digital date exists but is outside the window → not new this week.
  if (inDigital.length) return null;

  const globalDigital = all
    .flatMap((c) => c.release_dates.filter((r) => r.type === 4).map((r) => day(r.release_date)))
    .sort();
  const globalInWindow = globalDigital.find((d) => inWindow(d, w));
  if (globalInWindow) return { date: globalInWindow, type: "global_digital_release", verified: false };
  if (globalDigital.length) return null;

  if (primaryReleaseDate && inWindow(primaryReleaseDate, w)) {
    return { date: primaryReleaseDate, type: "primary_release", verified: false };
  }
  return null;
}

export interface TvSeason {
  season_number: number;
  air_date: string | null;
  episode_count: number;
}

/**
 * A TV title qualifies only when a season (or the series) premiered in the window.
 * An individual episode of an older season airing this week does not count.
 */
export function classifyTv(
  seasons: TvSeason[],
  networks: { id: number; name: string }[],
  provider: ProviderKey,
  w: ReleaseWindow,
): { date: string; type: ReleaseDateType; verified: boolean; seasonNumber: number; episodeCount: number | null } | null {
  const regular = seasons.filter((s) => s.season_number > 0);
  const premiered = regular.find((s) => inWindow(s.air_date, w));
  if (!premiered) return null;
  const isOriginal = networks.some((n) => resolveNetwork(n) === provider);
  const firstSeason = Math.min(...regular.map((s) => s.season_number));
  return {
    date: premiered.air_date!,
    type: premiered.season_number === firstSeason ? "series_premiere" : "season_premiere",
    verified: isOriginal,
    seasonNumber: premiered.season_number,
    episodeCount: premiered.episode_count > 0 ? premiered.episode_count : null,
  };
}

/** Collapse duplicate events (same platform, type, season) keeping the earliest date. */
export function dedupeReleases(releases: NormalizedRelease[]): NormalizedRelease[] {
  const best = new Map<string, NormalizedRelease>();
  for (const r of releases) {
    const key = `${r.providerKey}|${r.dateType}|${r.seasonNumber ?? 0}`;
    const prev = best.get(key);
    const better =
      !prev ||
      (r.status === "verified" && prev.status !== "verified") ||
      (r.status === prev.status && r.date < prev.date);
    if (better) best.set(key, r);
  }
  return [...best.values()];
}

export function isVerified(releases: { availabilityStatus: string }[]): boolean {
  return releases.some((r) => r.availabilityStatus === "verified");
}

export const DATE_TYPE_LABEL: Record<ReleaseDateType, string> = {
  in_digital_release: "India streaming release",
  series_premiere: "Series premiere",
  season_premiere: "Season premiere",
  global_digital_release: "Global digital release",
  primary_release: "First release (may be theatrical)",
};
