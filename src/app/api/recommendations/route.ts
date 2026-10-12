import type { MoodKey } from "@/config/taxonomy";
import { apiError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/db/users";
import { createAdminClient } from "@/lib/supabase/server";
import { recommendationsRequestSchema } from "@/lib/validation/schemas";
import { getCatalogue } from "@/services/catalogue.service";
import { ensureRecommendations } from "@/services/recommendations.service";

export const maxDuration = 120;

// Best-effort per-instance throttle; cached recommendations make repeat calls cheap anyway.
const lastCall = new Map<string, number>();
const MIN_INTERVAL_MS = 15_000;

/** Generate missing Gemini recommendations for this week's releases (cached ones are reused). */
export async function POST(req: Request) {
  try {
    const { user, db } = await requireUser();
    const { mood = null } = recommendationsRequestSchema.parse(await readJson(req));
    const prev = lastCall.get(user.id) ?? 0;
    if (Date.now() - prev < MIN_INTERVAL_MS) {
      return Response.json({ error: "Recommendations were just requested. Give it a few seconds." }, { status: 429 });
    }
    lastCall.set(user.id, Date.now());

    const prefs = await getPreferences(db, user.id);
    const catalogue = await getCatalogue(db, user.id, prefs, mood as MoodKey | null);
    const result = await ensureRecommendations({ admin: createAdminClient(), userId: user.id, prefs, items: catalogue.items, mood: mood as MoodKey | null });
    return Response.json({ ...catalogue, items: result.items, ai: { generated: result.generated, cached: result.cached, failed: result.failed, error: result.error } });
  } catch (err) {
    return apiError(err);
  }
}
