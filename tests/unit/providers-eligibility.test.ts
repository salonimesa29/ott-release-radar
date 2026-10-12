import { describe, expect, it } from "vitest";
import { resolveNetwork, resolveProvider } from "@/config/providers";
import {
  classifyMovie,
  classifyTv,
  dedupeReleases,
  isVerified,
  targetProviders,
  type IndiaProviders,
  type TvSeason,
} from "@/lib/release/eligibility";
import type { NormalizedRelease } from "@/lib/release/types";
import type { ReleaseWindow } from "@/types/domain";

const W: ReleaseWindow = { start: "2026-10-06", end: "2026-10-12" };

describe("provider filtering", () => {
  it("resolves providers by TMDB ID first", () => {
    expect(resolveProvider({ provider_id: 2336, provider_name: "JioHotstar" })).toBe("hotstar");
    expect(resolveProvider({ provider_id: 122, provider_name: "Disney Plus Hotstar" })).toBe("hotstar");
    expect(resolveProvider({ provider_id: 8, provider_name: "Netflix" })).toBe("netflix");
    expect(resolveProvider({ provider_id: 1796, provider_name: "Netflix basic with Ads" })).toBe("netflix");
    expect(resolveProvider({ provider_id: 119, provider_name: "Amazon Prime Video" })).toBe("prime_video");
  });

  it("falls back to the name when the ID is unknown (e.g. a renamed provider)", () => {
    expect(resolveProvider({ provider_id: 999999, provider_name: "JioHotstar" })).toBe("hotstar");
    expect(resolveProvider({ provider_id: 999999, provider_name: "  Amazon Prime Video  " })).toBe("prime_video");
    expect(resolveProvider({ provider_id: 999999, provider_name: "Netflix" })).toBe("netflix");
  });

  it("returns null for non-target providers", () => {
    expect(resolveProvider({ provider_id: 350, provider_name: "Apple TV Plus" })).toBeNull();
    expect(resolveProvider({ provider_id: 999999, provider_name: "Zee5" })).toBeNull();
    // Anchored pattern: a name merely containing "netflix" is not Netflix.
    expect(resolveProvider({ provider_id: 999999, provider_name: "Netflix Kids Channel Store" })).toBeNull();
  });

  it("resolves TV networks by ID then name", () => {
    expect(resolveNetwork({ id: 213, name: "Netflix" })).toBe("netflix");
    expect(resolveNetwork({ id: 1024, name: "Prime Video" })).toBe("prime_video");
    expect(resolveNetwork({ id: 424242, name: "JioHotstar" })).toBe("hotstar");
    expect(resolveNetwork({ id: 49, name: "HBO" })).toBeNull();
  });

  it("targetProviders keeps subscription/free/ads offers, ignores rent/buy and other platforms, de-duplicates", () => {
    const india: IndiaProviders & { rent: unknown[]; buy: unknown[] } = {
      link: "https://www.themoviedb.org/movie/1/watch?locale=IN",
      flatrate: [
        { provider_id: 8, provider_name: "Netflix" },
        { provider_id: 1796, provider_name: "Netflix basic with Ads" },
        { provider_id: 350, provider_name: "Apple TV Plus" },
      ],
      ads: [{ provider_id: 2336, provider_name: "JioHotstar" }],
      rent: [{ provider_id: 119, provider_name: "Amazon Prime Video" }],
      buy: [{ provider_id: 119, provider_name: "Amazon Prime Video" }],
    };
    const out = targetProviders(india);
    expect(out.map((o) => o.key)).toEqual(["netflix", "hotstar"]);
    expect(out[0].offer.provider_id).toBe(8); // first offer for a platform wins
  });

  it("targetProviders handles missing India data", () => {
    expect(targetProviders(undefined)).toEqual([]);
    expect(targetProviders({})).toEqual([]);
  });
});

const rd = (type: number, date: string) => ({ type, release_date: `${date}T00:00:00.000Z` });

describe("release eligibility: movies", () => {
  it("an India digital date in the window is a verified in_digital_release", () => {
    const res = classifyMovie({ results: [{ iso_3166_1: "IN", release_dates: [rd(3, "2026-08-01"), rd(4, "2026-10-09")] }] }, "2026-08-01", W);
    expect(res).toEqual({ date: "2026-10-09", type: "in_digital_release", verified: true });
  });

  it("an India digital date outside the window excludes the title even if the primary date is inside", () => {
    const res = classifyMovie({ results: [{ iso_3166_1: "IN", release_dates: [rd(4, "2026-09-01")] }] }, "2026-10-08", W);
    expect(res).toBeNull();
  });

  it("only a theatrical/primary date in the window gives an unverified primary_release", () => {
    const res = classifyMovie({ results: [{ iso_3166_1: "IN", release_dates: [rd(3, "2026-10-08")] }] }, "2026-10-08", W);
    expect(res).toEqual({ date: "2026-10-08", type: "primary_release", verified: false });
  });

  it("a non-India digital date in the window gives an unverified global_digital_release", () => {
    const res = classifyMovie({ results: [{ iso_3166_1: "US", release_dates: [rd(4, "2026-10-10")] }] }, "2026-06-01", W);
    expect(res).toEqual({ date: "2026-10-10", type: "global_digital_release", verified: false });
  });

  it("a global digital date outside the window excludes the title", () => {
    expect(classifyMovie({ results: [{ iso_3166_1: "US", release_dates: [rd(4, "2026-01-10")] }] }, "2026-10-10", W)).toBeNull();
  });

  it("no dates at all gives null", () => {
    expect(classifyMovie(undefined, null, W)).toBeNull();
    expect(classifyMovie({ results: [] }, "2026-01-01", W)).toBeNull();
  });
});

describe("release eligibility: TV", () => {
  const netflix = [{ id: 213, name: "Netflix" }];

  it("an older series with no season premiere in the window is excluded (weekly episodes don't count)", () => {
    const seasons: TvSeason[] = [
      { season_number: 0, air_date: "2026-10-08", episode_count: 1 }, // a special this week
      { season_number: 1, air_date: "2020-01-01", episode_count: 10 },
      { season_number: 2, air_date: "2026-08-15", episode_count: 12 }, // still airing weekly
    ];
    expect(classifyTv(seasons, netflix, "netflix", W)).toBeNull();
  });

  it("a season premiere of a network original is a verified season_premiere", () => {
    const seasons: TvSeason[] = [
      { season_number: 1, air_date: "2024-01-01", episode_count: 8 },
      { season_number: 2, air_date: "2026-10-09", episode_count: 8 },
    ];
    expect(classifyTv(seasons, netflix, "netflix", W)).toEqual({
      date: "2026-10-09",
      type: "season_premiere",
      verified: true,
      seasonNumber: 2,
      episodeCount: 8,
    });
  });

  it("a season premiere of a show from another network is unverified", () => {
    const seasons: TvSeason[] = [
      { season_number: 1, air_date: "2022-01-01", episode_count: 6 },
      { season_number: 3, air_date: "2026-10-07", episode_count: 0 },
    ];
    const res = classifyTv(seasons, [{ id: 49, name: "HBO" }], "hotstar", W);
    expect(res?.verified).toBe(false);
    expect(res?.type).toBe("season_premiere");
    expect(res?.episodeCount).toBeNull(); // 0 episodes reported means unknown
  });

  it("an original of a different platform is not verified for this provider", () => {
    const seasons: TvSeason[] = [{ season_number: 1, air_date: "2026-10-10", episode_count: 6 }];
    expect(classifyTv(seasons, netflix, "prime_video", W)?.verified).toBe(false);
  });

  it("the first season premiering in the window is a series_premiere", () => {
    const seasons: TvSeason[] = [{ season_number: 1, air_date: "2026-10-10", episode_count: 6 }];
    expect(classifyTv(seasons, netflix, "netflix", W)?.type).toBe("series_premiere");
  });
});

const nr = (o: Partial<NormalizedRelease>): NormalizedRelease => ({
  providerKey: "netflix",
  providerId: 8,
  providerName: "Netflix",
  date: "2026-10-09",
  dateType: "in_digital_release",
  status: "verified",
  seasonNumber: null,
  episodeCount: null,
  sourceName: "tmdb",
  sourceUrl: null,
  ...o,
});

describe("duplicate release detection", () => {
  it("collapses same platform + type + season keeping the earliest date", () => {
    const out = dedupeReleases([nr({ date: "2026-10-10" }), nr({ date: "2026-10-08" }), nr({ date: "2026-10-11" })]);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-10-08");
  });

  it("keeps distinct platforms, date types and seasons apart", () => {
    const out = dedupeReleases([
      nr({}),
      nr({ providerKey: "hotstar", providerId: 2336 }),
      nr({ dateType: "season_premiere", seasonNumber: 2 }),
      nr({ dateType: "season_premiere", seasonNumber: 3 }),
    ]);
    expect(out).toHaveLength(4);
  });

  it("treats a null season like season 0", () => {
    expect(dedupeReleases([nr({ seasonNumber: null }), nr({ seasonNumber: 0 })])).toHaveLength(1);
  });

  it("prefers a verified event over an unverified one for the same key", () => {
    const out = dedupeReleases([nr({ status: "unverified_date", date: "2026-10-08" }), nr({ status: "verified", date: "2026-10-09" })]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("verified");
  });

  it("returns an empty list for no input", () => {
    expect(dedupeReleases([])).toEqual([]);
  });

  it("isVerified is true when any release is verified", () => {
    expect(isVerified([{ availabilityStatus: "unverified_date" }, { availabilityStatus: "verified" }])).toBe(true);
    expect(isVerified([{ availabilityStatus: "unverified_date" }])).toBe(false);
    expect(isVerified([])).toBe(false);
  });
});
