import { PROVIDERS } from "@/config/providers";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { previewDigest } from "@/services/digest.service";

export const maxDuration = 120;

/** Build the user's Friday digest without sending anything. */
export async function POST() {
  try {
    const { user } = await requireUser();
    const d = await previewDigest(user.id);
    return Response.json({
      window: d.window,
      messages: d.messages,
      aiError: d.aiError,
      eligibleCount: d.eligibleCount,
      items: d.items.map((i) => ({
        id: i.title.id,
        title: i.title.title,
        platforms: i.platforms.map((p) => PROVIDERS[p].shortLabel),
        verdict: i.recommendation?.verdict ?? null,
        score: i.recommendation?.matchScore ?? null,
        reason: i.recommendation?.explanation ?? null,
        matched: i.recommendation?.matchedPreferences ?? [],
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}
