import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { GENRES, languageLabel } from "./constants";
import type { Candidate, DigestItem, Preferences } from "./types";

type Judgement = Pick<DigestItem, "synopsis" | "verdict" | "score" | "reason">;

export function hasGemini() {
  return !!process.env.GEMINI_API_KEY;
}

/** Ask Gemini Flash for a watch/skip verdict per title. Falls back to a simple heuristic. */
export async function judge(candidates: Candidate[], prefs: Preferences): Promise<DigestItem[]> {
  if (candidates.length === 0) return [];
  let verdicts = new Map<number, Judgement>();
  if (hasGemini()) {
    try {
      verdicts = await askGemini(candidates, prefs);
    } catch (err) {
      console.error("Gemini failed, using heuristic", err);
    }
  }
  return candidates
    .map((c) => ({ ...c, ...(verdicts.get(c.tmdbId) ?? heuristic(c, prefs)) }))
    .sort((a, b) => b.score - a.score);
}

async function askGemini(candidates: Candidate[], prefs: Preferences) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const profile = {
    favourite_genres: prefs.genres,
    languages: prefs.languages.map(languageLabel),
    platforms: prefs.platforms,
  };
  const titles = candidates.map((c) => ({
    id: c.tmdbId,
    title: c.title,
    type: c.kind === "movie" ? "Movie" : c.seasonLabel ?? "Series",
    language: languageLabel(c.language),
    genres: c.genres,
    tmdb_rating: c.rating,
    overview: c.overview.slice(0, 600),
  }));

  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    contents: `You curate a weekly "New on OTT in India" digest for one viewer.

Viewer profile: ${JSON.stringify(profile)}
Note: "Indie Drama" means grounded, character-driven, small-scale drama, not big family melodrama.

For EACH title below return:
- score: 0-100, how well it fits this viewer's taste (genre fit first, then tone and quality signals).
- verdict: "watch" if score >= 60, else "skip".
- reason: one punchy line (max 18 words) saying why, addressed to the viewer as "you".
- synopsis: exactly two short sentences, spoiler-free, based only on the overview. If the overview is empty, say so briefly.

Titles: ${JSON.stringify(titles)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            score: { type: Type.INTEGER },
            verdict: { type: Type.STRING, enum: ["watch", "skip"] },
            reason: { type: Type.STRING },
            synopsis: { type: Type.STRING },
          },
          required: ["id", "score", "verdict", "reason", "synopsis"],
        },
      },
    },
  });

  const parsed = JSON.parse(res.text ?? "[]") as (Judgement & { id: number })[];
  return new Map(
    parsed.map(({ id, ...j }) => [id, { ...j, score: Math.max(0, Math.min(100, Math.round(j.score))) }]),
  );
}

export function heuristic(c: Candidate, prefs: Preferences): Judgement {
  const matched = prefs.genres.filter((g) => (GENRES[g] ?? [g]).some((n) => c.genres.includes(n)));
  const score = Math.min(100, 20 + matched.length * 15 + Math.round((c.rating ?? 6) * 4));
  const sentences = c.overview.match(/[^.!?]+[.!?]+/g) ?? [c.overview || "No synopsis available yet."];
  return {
    score,
    verdict: score >= 60 ? "watch" : "skip",
    reason: matched.length ? `Hits your ${matched.join(" + ")} taste.` : "Outside your usual genres.",
    synopsis: sentences.slice(0, 2).join(" ").trim(),
  };
}
