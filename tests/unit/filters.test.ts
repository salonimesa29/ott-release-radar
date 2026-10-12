import { describe, expect, it } from "vitest";
import { applyFilters, discoveryStats, fitsWatchTime, weightedPick, type DiscoveryFilters } from "@/lib/ranking/filters";
import { hiddenGemIds, matchedGenreKeys, matchesAnyGenre, matchesLanguage, metadataConfidence } from "@/lib/ranking/signals";
import { makeItem } from "../fixtures";

const filters = (o: Partial<DiscoveryFilters> = {}): DiscoveryFilters => ({
  platforms: [],
  genres: [],
  languages: [],
  quick: "all",
  watchTime: "any",
  mood: null,
  hiddenGems: false,
  verifiedOnly: false,
  verdict: "any",
  search: "",
  sort: "newest",
  ...o,
});

describe("genre filtering", () => {
  it("maps preference genres to movie genre IDs", () => {
    expect(matchesAnyGenre({ mediaType: "movie", genreIds: [53] }, ["thriller"])).toBe(true);
    expect(matchesAnyGenre({ mediaType: "movie", genreIds: [9648] }, ["thriller"])).toBe(false);
  });

  it("maps thriller on TV to Mystery / Crime (TMDB has no TV Thriller genre)", () => {
    expect(matchesAnyGenre({ mediaType: "tv", genreIds: [9648] }, ["thriller"])).toBe(true);
    expect(matchesAnyGenre({ mediaType: "tv", genreIds: [80] }, ["thriller"])).toBe(true);
    expect(matchesAnyGenre({ mediaType: "tv", genreIds: [53] }, ["thriller"])).toBe(false);
  });

  it("uses TV-specific IDs for sci-fi and action", () => {
    expect(matchesAnyGenre({ mediaType: "tv", genreIds: [10765] }, ["science_fiction"])).toBe(true);
    expect(matchesAnyGenre({ mediaType: "tv", genreIds: [878] }, ["science_fiction"])).toBe(false);
    expect(matchesAnyGenre({ mediaType: "tv", genreIds: [10759] }, ["action"])).toBe(true);
  });

  it("genres with no TV equivalent never match a series", () => {
    expect(matchesAnyGenre({ mediaType: "tv", genreIds: [10749, 27] }, ["romance", "horror"])).toBe(false);
  });

  it("an empty genre preference matches everything", () => {
    expect(matchesAnyGenre({ mediaType: "movie", genreIds: [] }, [])).toBe(true);
  });

  it("matchedGenreKeys lists every matching key", () => {
    expect(matchedGenreKeys({ mediaType: "movie", genreIds: [53, 80, 35] }, ["thriller", "crime", "romance"])).toEqual(["thriller", "crime"]);
  });

  it("applyFilters keeps only titles in the selected genres", () => {
    const thriller = makeItem({ title: { genreIds: [53] } });
    const comedy = makeItem({ title: { genreIds: [35] } });
    const tvMystery = makeItem({ title: { mediaType: "tv", genreIds: [9648], episodeRuntimeMinutes: 45 } });
    const out = applyFilters([thriller, comedy, tvMystery], filters({ genres: ["thriller"] }));
    expect(out.items.map((i) => i.title.id).sort()).toEqual([thriller.title.id, tvMystery.title.id].sort());
  });
});

describe("language filtering", () => {
  it("matchesLanguage compares the original language", () => {
    expect(matchesLanguage({ originalLanguage: "ta" }, ["ta", "hi"])).toBe(true);
    expect(matchesLanguage({ originalLanguage: "en" }, ["ta", "hi"])).toBe(false);
    expect(matchesLanguage({ originalLanguage: "en" }, [])).toBe(true);
  });

  it("applyFilters keeps only titles in the selected languages", () => {
    const hi = makeItem({ title: { originalLanguage: "hi" } });
    const ta = makeItem({ title: { originalLanguage: "ta" } });
    const en = makeItem({ title: { originalLanguage: "en" } });
    const out = applyFilters([hi, ta, en], filters({ languages: ["ta", "en"] }));
    expect(out.items.map((i) => i.title.originalLanguage).sort()).toEqual(["en", "ta"]);
  });

  it("combines language with platform and verified-only filters", () => {
    const ok = makeItem({ title: { originalLanguage: "ta" }, release: { providerKey: "hotstar" } });
    const wrongPlatform = makeItem({ title: { originalLanguage: "ta" }, release: { providerKey: "netflix" } });
    const unverified = makeItem({ title: { originalLanguage: "ta" }, release: { providerKey: "hotstar", availabilityStatus: "unverified_date" } });
    const out = applyFilters([ok, wrongPlatform, unverified], filters({ languages: ["ta"], platforms: ["hotstar"], verifiedOnly: true }));
    expect(out.items).toEqual([ok]);
  });
});

describe("watch-time fit", () => {
  it("series 'under 30' uses the episode runtime, not the season length", () => {
    const item = makeItem({ title: { mediaType: "tv", runtimeMinutes: null, episodeRuntimeMinutes: 25, numberOfEpisodes: 10 } });
    expect(fitsWatchTime(item, "under_30")).toBe("yes");
    const long = makeItem({ title: { mediaType: "tv", runtimeMinutes: null, episodeRuntimeMinutes: 45 } });
    expect(fitsWatchTime(long, "under_30")).toBe("no");
    expect(fitsWatchTime(long, "under_60")).toBe("yes");
  });

  it("unknown runtime reports 'unknown' instead of guessing", () => {
    expect(fitsWatchTime(makeItem({ title: { mediaType: "tv", episodeRuntimeMinutes: null } }), "under_30")).toBe("unknown");
    expect(fitsWatchTime(makeItem({ title: { mediaType: "movie", runtimeMinutes: null } }), "under_90")).toBe("unknown");
    expect(fitsWatchTime(makeItem({ title: { mediaType: "movie", runtimeMinutes: null } }), "movie_night")).toBe("unknown");
  });

  it("movie night needs a 90+ minute movie; binge needs a series with 4+ episodes", () => {
    expect(fitsWatchTime(makeItem({ title: { runtimeMinutes: 95 } }), "movie_night")).toBe("yes");
    expect(fitsWatchTime(makeItem({ title: { runtimeMinutes: 80 } }), "movie_night")).toBe("no");
    expect(fitsWatchTime(makeItem({ title: { mediaType: "tv" } }), "movie_night")).toBe("no");
    expect(fitsWatchTime(makeItem({ title: { mediaType: "tv", numberOfEpisodes: 2 }, release: { episodeCount: 8 } }), "binge")).toBe("yes");
    expect(fitsWatchTime(makeItem({ title: { mediaType: "tv", numberOfEpisodes: 3 } }), "binge")).toBe("no");
    expect(fitsWatchTime(makeItem({ title: { mediaType: "movie" } }), "binge")).toBe("no");
  });

  it("applyFilters counts unknown durations and excludes them", () => {
    const known = makeItem({ title: { runtimeMinutes: 85 } });
    const unknown = makeItem({ title: { runtimeMinutes: null } });
    const out = applyFilters([known, unknown], filters({ watchTime: "under_90" }));
    expect(out.items).toEqual([known]);
    expect(out.unknownDuration).toBe(1);
  });
});

describe("weighted pick", () => {
  const strong = makeItem({ recommendation: { matchScore: 90, verdict: "watch" } });
  const weak = makeItem({ recommendation: { matchScore: 10, verdict: "maybe" } });

  it("is deterministic with an injected random source", () => {
    expect(weightedPick([strong, weak], filters(), () => 0)).toBe(strong);
    expect(weightedPick([strong, weak], filters(), () => 0.999)).toBe(weak);
    // 90² = 8100 vs 10² = 100: 0.98 of the total still lands on the strong match.
    expect(weightedPick([strong, weak], filters(), () => 0.98)).toBe(strong);
  });

  it("never picks skip verdicts or not-interested titles when alternatives exist", () => {
    const skip = makeItem({ recommendation: { matchScore: 10, verdict: "skip" } });
    const notInterested = makeItem({ recommendation: { matchScore: 99, verdict: "watch" }, watchStatus: "not_interested" });
    for (const r of [0, 0.5, 0.999]) expect(weightedPick([skip, notInterested, weak], filters(), () => r)).toBe(weak);
  });

  it("falls back to the full list when everything is filtered out", () => {
    const skip = makeItem({ recommendation: { matchScore: 10, verdict: "skip" } });
    expect(weightedPick([skip], filters(), () => 0.5)).toBe(skip);
  });
});

describe("hidden gems", () => {
  it("flags titles under 250 votes and below median popularity", () => {
    const a = makeItem({ title: { popularity: 10, voteCount: 100 } });
    const b = makeItem({ title: { popularity: 20, voteCount: 900 } }); // too many votes
    const c = makeItem({ title: { popularity: 30, voteCount: 50 } }); // above the median (20)
    const d = makeItem({ title: { popularity: 40, voteCount: 10 } });
    const e = makeItem({ title: { popularity: 5, voteCount: null } }); // no vote data → never a gem
    expect([...hiddenGemIds([a, b, c, d, e])]).toEqual([a.title.id]);
  });

  it("returns no gems when popularity is unknown for all", () => {
    expect(hiddenGemIds([makeItem({ title: { popularity: null } })]).size).toBe(0);
  });
});

describe("metadata confidence", () => {
  it("is high only with overview, genres and length", () => {
    expect(metadataConfidence(makeItem().title)).toBe("high");
    expect(metadataConfidence(makeItem({ title: { runtimeMinutes: null } }).title)).toBe("medium");
    expect(metadataConfidence(makeItem({ title: { overview: null } }).title)).toBe("low");
    expect(metadataConfidence(makeItem({ title: { genreIds: [] } }).title)).toBe("low");
  });
});

describe("empty-result handling", () => {
  it("applyFilters on [] returns an empty result", () => {
    expect(applyFilters([], filters({ hiddenGems: true, genres: ["thriller"], sort: "match" }))).toEqual({ items: [], unknownDuration: 0 });
  });

  it("applyFilters with no matches returns an empty list without throwing", () => {
    expect(applyFilters([makeItem({ title: { originalLanguage: "hi" } })], filters({ languages: ["ko"] })).items).toEqual([]);
  });

  it("discoveryStats on [] is all zeros", () => {
    expect(discoveryStats([], { genres: ["thriller"], languages: ["hi"] }, 3)).toEqual({
      eligible: 0,
      unverified: 0,
      genreMatches: 0,
      languageMatches: 0,
      strongMatches: 0,
      scored: 0,
      watchlist: 3,
    });
  });

  it("weightedPick([]) is null", () => {
    expect(weightedPick([], filters(), () => 0.5)).toBeNull();
  });

  it("hiddenGemIds([]) is empty", () => {
    expect(hiddenGemIds([]).size).toBe(0);
  });
});
