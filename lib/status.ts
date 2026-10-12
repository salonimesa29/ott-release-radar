import "server-only";
import { hasGemini } from "./gemini";
import { hasSupabase } from "./store";
import { hasTmdb } from "./tmdb";

export function integrationStatus(): Record<string, boolean> {
  return {
    "TMDB live data": hasTmdb(),
    "Gemini Flash": hasGemini(),
    Supabase: hasSupabase(),
    Telegram: !!process.env.TELEGRAM_BOT_TOKEN,
  };
}
