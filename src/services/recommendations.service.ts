import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MoodKey } from "@/config/taxonomy";
import { isConfigured } from "@/lib/env";
import { GeminiError, generateRecommendations } from "@/lib/gemini/client";
import { recordIntegration } from "@/lib/db/ops";
import { getPreferences, listNotInterested, saveRecommendations } from "@/lib/db/users";
import { scoringExclusion } from "@/lib/ranking/signals";
import type { CatalogueItem, Preferences } from "@/types/domain";
import { getCatalogue, preferenceFingerprint } from "./catalogue.service";

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
  const relevant = items.filter((i) => scoringExclusion(i, prefs) === null);
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

/**
 * After the daily refresh, generate missing verdicts for every user so pages open already
 * scored. Cached verdicts are reused, so this only costs Gemini calls for new/changed titles.
 */
export async function prescoreAllUsers(admin: SupabaseClient, maxUsers = 25) {
  if (!isConfigured("gemini")) return { users: 0, generated: 0, failed: 0 };
  const { data, error } = await admin.from("user_preferences").select("user_id").limit(maxUsers);
  if (error) throw new Error(`Database error while listing users: ${error.message}`);
  let generated = 0;
  let failed = 0;
  for (const { user_id: userId } of data ?? []) {
    try {
      const prefs = await getPreferences(admin, userId);
      const catalogue = await getCatalogue(admin, userId, prefs);
      const r = await ensureRecommendations({ admin, userId, prefs, items: catalogue.items, mood: null });
      generated += r.generated;
      failed += r.failed;
    } catch (err) {
      console.error("prescore failed for a user", err);
      failed++;
    }
  }
  return { users: data?.length ?? 0, generated, failed };
}
