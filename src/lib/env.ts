import "server-only";
import { z } from "zod";

/**
 * Server-side configuration, validated per integration so a missing Telegram token
 * doesn't break the catalogue. Every error message says exactly what to set.
 */
const groups = {
  supabase: z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  }),
  tmdb: z.object({ TMDB_API_KEY: z.string().min(16) }),
  gemini: z.object({
    GEMINI_API_KEY: z.string().min(20),
    GEMINI_MODEL: z.string().min(1).default("gemini-flash-latest"),
  }),
  telegram: z.object({ TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]{30,}$/, "looks malformed") }),
  cron: z.object({ CRON_SECRET: z.string().min(16, "must be at least 16 characters") }),
} as const;

type Groups = typeof groups;
export type EnvGroup = keyof Groups;

const HINTS: Record<EnvGroup, string> = {
  supabase: "Supabase → Project Settings → API",
  tmdb: "themoviedb.org → Settings → API (Read Access Token or v3 key)",
  gemini: "aistudio.google.com/app/apikey",
  telegram: "Telegram @BotFather → /newbot",
  cron: "any random string of 16+ characters (e.g. `openssl rand -hex 32`)",
};

export class ConfigError extends Error {
  constructor(
    public group: EnvGroup,
    public missing: string[],
  ) {
    super(`${group} is not configured: set ${missing.join(", ")} (${HINTS[group]})`);
    this.name = "ConfigError";
  }
}

export function env<G extends EnvGroup>(group: G): z.infer<Groups[G]> {
  const parsed = groups[group].safeParse(process.env);
  if (!parsed.success) {
    throw new ConfigError(group, parsed.error.issues.map((i) => `${String(i.path[0])} (${i.message})`));
  }
  return parsed.data as z.infer<Groups[G]>;
}

export function isConfigured(group: EnvGroup): boolean {
  return groups[group].safeParse(process.env).success;
}
