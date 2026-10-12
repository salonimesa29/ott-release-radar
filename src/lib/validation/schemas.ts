import { z } from "zod";
import { PROVIDER_KEYS } from "@/config/providers";
import { GENRE_KEYS, LANGUAGES, MOODS, WATCH_STATUSES } from "@/config/taxonomy";

const languageCode = z.string().regex(/^[a-z]{2}$/).refine((c) => LANGUAGES.some((l) => l.code === c), "unsupported language");
const unique = <T>(arr: T[]) => [...new Set(arr)];

export const preferencesUpdateSchema = z
  .object({
    genres: z.array(z.enum(GENRE_KEYS)).max(GENRE_KEYS.length).transform(unique),
    languages: z.array(languageCode).min(1, "Pick at least one language").max(20).transform(unique),
    platforms: z.array(z.enum(PROVIDER_KEYS)).min(1, "Pick at least one platform").transform(unique),
    contentTypes: z.array(z.enum(["movie", "tv"])).min(1, "Pick movies, series or both").transform(unique),
    runtime: z.enum(["any", "under_60", "under_120", "over_120"]),
    dubbed: z.enum(["original_only", "dubbed_ok", "no_preference"]),
    popularity: z.enum(["popular", "balanced", "hidden_gems"]),
    genreExploration: z.enum(["familiar", "open"]),
    discoveryMode: z.enum(["stick", "balanced", "surprise"]),
    mood: z.enum(MOODS.map((m) => m.key) as [string, ...string[]]).nullable(),
    useFeedback: z.boolean(),
    digestEnabled: z.boolean(),
    digestDay: z.number().int().min(0).max(6),
  })
  .partial()
  .strict();
export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;

export const watchlistUpsertSchema = z.object({
  titleId: z.uuid(),
  status: z.enum(WATCH_STATUSES.map((s) => s.key) as [string, ...string[]]),
});

export const watchlistDeleteSchema = z.object({ titleId: z.uuid() });

export const recommendationsRequestSchema = z.object({
  mood: z.enum(MOODS.map((m) => m.key) as [string, ...string[]]).nullable().optional(),
});

export const searchQuerySchema = z.object({ q: z.string().trim().min(2).max(80) });

export const profileUpdateSchema = z.object({ displayName: z.string().trim().min(1).max(80) });
