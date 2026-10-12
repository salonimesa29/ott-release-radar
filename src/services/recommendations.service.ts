import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MoodKey } from "@/config/taxonomy";
import { isConfigured } from "@/lib/env";
import { GeminiError, generateRecommendations } from "@/lib/gemini/client";
import { recordIntegration } from "@/lib/db/ops";
import { listNotInterested, saveRecommendations } from "@/lib/db/users";
import { matchesLanguage, onPlatforms } from "@/lib/ranking/signals";
import type { CatalogueItem, Preferences } from "@/types/domain";
import { preferenceFingerprint } from "./catalogue.service";

const MAX_PER_REQUEST = 60;

export interface EnsureResult {
  items: CatalogueItem[];
  generated: number;
  cached: number;
  failed: number;
  error: string | null;
}

/**
 * Make sure every relevant item has a recommendation for the current preference profile.
 * Only titles without a fresh cached recommendation are sent to Gemini (batched).
 * If Gemini fails, items are returned unscored with an error message — never fabricated.
 */
export async function ensureRecommendations(opts: {
  admin: SupabaseClient;
  userId: string;
  prefs: Preferences;
  items: CatalogueItem[];
  mood: MoodKey | null;
}): Promise<EnsureResult> {
  const { admin, userId, prefs, items, mood } = opts;
  // Hard constraints: only spend Gemini calls on titles the user could actually watch.
  const relevant = items.filter(
    (i) =>
      onPlatforms(i.platforms, prefs.platforms) &&
      matchesLanguage(i.title, prefs.languages) &&
      prefs.contentTypes.includes(i.title.mediaType),
  );
  const missing = relevant.filter((i) => !i.recommendation).slice(0, MAX_PER_REQUEST);
  const cached = relevant.length - relevant.filter((i) => !i.recommendation).length;
  if (!missing.length) return { items, generated: 0, cached, failed: 0, error: null };

  if (!isConfigured("gemini")) {
    return { items, generated: 0, cached, failed: missing.length, error: "Gemini isn't configured (GEMINI_API_KEY), so AI verdicts are unavailable." };
  }

  const notInterestedIds = prefs.useFeedback ? await listNotInterested(admin, userId) : [];
  const notInterestedTitles = items.filter((i) => notInterestedIds.includes(i.title.id)).map((i) => i.title.title);

  try {
    const result = await generateRecommendations(missing, prefs, { mood, notInterestedTitles });
    const prefFp = preferenceFingerprint(prefs, mood);
    const byId = new Map(items.map((i) => [i.title.id, i]));
    await saveRecommendations(
      admin,
      userId,
      result.recommendations.map((r) => ({
        ...r,
        metadataFingerprint: byId.get(r.titleId)!.title.metadataFingerprint,
        preferenceFingerprint: prefFp,
      })),
    );
    await recordIntegration(admin, "gemini", true);
    const recs = new Map(result.recommendations.map((r) => [r.titleId, r]));
    if (result.rejected.length) console.warn("Gemini outputs rejected", result.rejected);
    return {
      items: items.map((i) => (recs.has(i.title.id) ? { ...i, recommendation: recs.get(i.title.id)! } : i)),
      generated: result.recommendations.length,
      cached,
      failed: result.rejected.length,
      error: result.rejected.length ? `${result.rejected.length} title(s) couldn't be scored reliably and were left unscored.` : null,
    };
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : `Recommendation generation failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(message);
    await recordIntegration(admin, "gemini", false, message);
    return {
      items,
      generated: 0,
      cached,
      failed: missing.length,
      error: err instanceof GeminiError && err.transient ? "Gemini is busy right now. Your catalogue still works — retry in a minute." : "AI recommendations failed. The catalogue still works; retry later.",
    };
  }
}
