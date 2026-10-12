/** Preference genres → TMDB genre IDs. TMDB's movie and TV genre lists differ. */
export const GENRE_KEYS = [
  "thriller",
  "science_fiction",
  "indie_drama",
  "comedy",
  "romance",
  "crime",
  "mystery",
  "action",
  "horror",
  "documentary",
  "animation",
  "family",
] as const;
export type GenreKey = (typeof GENRE_KEYS)[number];

export const GENRES: Record<GenreKey, { label: string; movie: number[]; tv: number[]; note?: string }> = {
  thriller: { label: "Thriller", movie: [53], tv: [9648, 80], note: "TMDB has no TV Thriller genre; Mystery and Crime are used for series." },
  science_fiction: { label: "Science fiction", movie: [878], tv: [10765] },
  indie_drama: { label: "Indie drama", movie: [18], tv: [18], note: "TMDB has no 'indie' tag; Drama is matched and Gemini judges the indie fit." },
  comedy: { label: "Comedy", movie: [35], tv: [35] },
  romance: { label: "Romance", movie: [10749], tv: [] },
  crime: { label: "Crime", movie: [80], tv: [80] },
  mystery: { label: "Mystery", movie: [9648], tv: [9648] },
  action: { label: "Action", movie: [28], tv: [10759] },
  horror: { label: "Horror", movie: [27], tv: [] },
  documentary: { label: "Documentary", movie: [99], tv: [99] },
  animation: { label: "Animation", movie: [16], tv: [16] },
  family: { label: "Family", movie: [10751], tv: [10751, 10762] },
};

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "hi", label: "Hindi" },
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "ml", label: "Malayalam" },
  { code: "kn", label: "Kannada" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "pa", label: "Punjabi" },
  { code: "gu", label: "Gujarati" },
  { code: "ko", label: "Korean" },
  { code: "ja", label: "Japanese" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "tr", label: "Turkish" },
  { code: "zh", label: "Chinese" },
  { code: "th", label: "Thai" },
  { code: "id", label: "Indonesian" },
];

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}

export const MOODS = [
  { key: "mind_bending", label: "Mind-bending", genres: [878, 9648, 10765] },
  { key: "edge_of_seat", label: "Edge-of-your-seat", genres: [53, 80, 28, 9648, 10759, 27] },
  { key: "feel_good", label: "Light and feel-good", genres: [35, 10751, 10749, 16] },
  { key: "emotionally_intense", label: "Emotionally intense", genres: [18, 10752, 36] },
  { key: "thought_provoking", label: "Thought-provoking", genres: [99, 18, 878, 36] },
  { key: "something_different", label: "Something different", genres: [] },
] as const;
export type MoodKey = (typeof MOODS)[number]["key"];

export const DISCOVERY_MODES = [
  { key: "stick", label: "Stick to my taste" },
  { key: "balanced", label: "Balanced" },
  { key: "surprise", label: "Surprise me" },
] as const;
export type DiscoveryMode = (typeof DISCOVERY_MODES)[number]["key"];

export const WATCH_STATUSES = [
  { key: "want_to_watch", label: "Want to watch" },
  { key: "watching", label: "Watching" },
  { key: "watched", label: "Watched" },
  { key: "not_interested", label: "Not interested" },
] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number]["key"];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
