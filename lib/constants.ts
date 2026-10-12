import type { Platform, Preferences } from "./types";

export const PLATFORMS: Platform[] = ["Netflix", "Prime Video", "JioHotstar"];

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "hi", label: "Hindi" },
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "ml", label: "Malayalam" },
  { code: "kn", label: "Kannada" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "ko", label: "Korean" },
];

/** Preference genre → TMDB genre names (movie and TV lists differ). */
export const GENRES: Record<string, string[]> = {
  Thriller: ["Thriller", "Crime", "Mystery"],
  "Sci-Fi": ["Science Fiction", "Sci-Fi & Fantasy"],
  "Indie Drama": ["Drama"],
  Comedy: ["Comedy"],
  Action: ["Action", "Action & Adventure"],
  Romance: ["Romance"],
  Horror: ["Horror"],
  Documentary: ["Documentary"],
  Animation: ["Animation"],
  Family: ["Family", "Kids"],
};

export const DEFAULT_PREFERENCES: Preferences = {
  genres: ["Thriller", "Sci-Fi", "Indie Drama"],
  languages: ["hi", "en", "ta"],
  platforms: [...PLATFORMS],
  windowDays: 7,
  telegramChatId: null,
};

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}
