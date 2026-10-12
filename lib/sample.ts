import { addDays } from "./dates";
import type { Candidate } from "./types";

/** Fictional titles shown only when TMDB_API_KEY is missing, so the UI can be previewed. */
export function sampleCandidates(w: { start: string; end: string }): Candidate[] {
  const d = (n: number) => addDays(w.start, n);
  const base = { posterPath: null, runtimeMinutes: null, episodeCount: null, seasonLabel: null };
  return [
    { ...base, tmdbId: 1, kind: "tv", title: "The Monsoon Ledger", language: "hi", releaseDate: d(1), platforms: ["Netflix"], genres: ["Crime", "Drama", "Mystery"], runtimeMinutes: 48, episodeCount: 8, seasonLabel: "New series", overview: "A junior auditor in Mumbai finds a ledger that links a flood-relief fund to a string of disappearances. As the rains close in, she has to choose who to trust.", rating: 7.8 },
    { ...base, tmdbId: 2, kind: "movie", title: "Orbit of Ash", language: "en", releaseDate: d(2), platforms: ["Prime Video"], genres: ["Science Fiction", "Thriller"], runtimeMinutes: 126, overview: "The last crew of a failing space station receives a distress call from a ship that left Earth a century ago. Answering it could save them or doom everyone below.", rating: 7.1 },
    { ...base, tmdbId: 3, kind: "movie", title: "Kaaval", language: "ta", releaseDate: d(3), platforms: ["JioHotstar"], genres: ["Thriller", "Action"], runtimeMinutes: 141, overview: "A night-shift constable in Madurai becomes the only witness to a crime the whole town wants forgotten. One long night tests every loyalty he has.", rating: 7.4 },
    { ...base, tmdbId: 4, kind: "movie", title: "Small Rooms", language: "hi", releaseDate: d(4), platforms: ["Netflix", "Prime Video"], genres: ["Drama"], runtimeMinutes: 104, overview: "Two estranged sisters share a rented flat in Pune for one last month before it is sold. Old arguments resurface between grocery runs and power cuts.", rating: 7.6 },
    { ...base, tmdbId: 5, kind: "tv", title: "Signal Lost", language: "en", releaseDate: d(2), platforms: ["JioHotstar"], genres: ["Sci-Fi & Fantasy", "Drama"], runtimeMinutes: 52, episodeCount: 6, seasonLabel: "Season 2", overview: "The researchers who decoded a signal from deep space now face its consequences on the ground. Season two follows the fallout across three continents.", rating: 6.9 },
    { ...base, tmdbId: 6, kind: "movie", title: "Wedding Season Chaos", language: "hi", releaseDate: d(5), platforms: ["Prime Video"], genres: ["Comedy", "Romance", "Drama"], runtimeMinutes: 132, overview: "Three weddings, one family, and a single banquet hall booked for all of them on the same day. Nobody is willing to back down.", rating: 5.4 },
    { ...base, tmdbId: 7, kind: "tv", title: "Dead Reckoning Coast", language: "ta", releaseDate: d(6), platforms: ["Netflix"], genres: ["Crime", "Mystery"], runtimeMinutes: 40, episodeCount: 7, seasonLabel: "New series", overview: "A fishing village on the Coromandel coast wakes to find its oldest boat burned and its owner gone. A returning journalist starts asking the questions no one else will.", rating: 7.2 },
  ].filter((c) => c.releaseDate <= w.end) as Candidate[];
}
