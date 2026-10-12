import { z } from "zod";
import type { Confidence } from "@/types/domain";

export const recommendationSchema = z.object({
  title_id: z.string().min(1),
  synopsis: z.string().trim().min(10).max(400),
  verdict: z.enum(["watch", "maybe", "skip"]),
  match_score: z.number().int().min(0).max(100),
  reason: z.string().trim().min(5).max(240),
  matched_preferences: z.array(z.string().trim().min(1)).max(12),
  confidence: z.enum(["high", "medium", "low"]),
});
export const batchSchema = z.object({ recommendations: z.array(z.unknown()) });

export type RawRecommendation = z.infer<typeof recommendationSchema>;

/** Score bands each verdict may use. Overlap is deliberate; contradictions are rejected. */
export const VERDICT_BANDS = { watch: [60, 100], maybe: [35, 79], skip: [0, 54] } as const;

export interface ValidationContext {
  /** IDs that were sent in this batch. */
  titleIds: Set<string>;
  /** Preference labels the model may cite (case-insensitive). */
  allowedPreferences: string[];
  /** Per-title metadata confidence cap. */
  confidenceCap: Map<string, Confidence>;
}

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * Validate one model output item: schema, known title, verdict/score consistency.
 * Unknown matched preferences are dropped; confidence is capped by metadata completeness.
 */
export function validateRecommendation(raw: unknown, ctx: ValidationContext): { ok: true; value: RawRecommendation } | { ok: false; error: string } {
  const parsed = recommendationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `schema: ${parsed.error.issues[0]?.message ?? "invalid"}` };
  const r = parsed.data;
  if (!ctx.titleIds.has(r.title_id)) return { ok: false, error: `unknown title_id ${r.title_id}` };
  const [lo, hi] = VERDICT_BANDS[r.verdict];
  if (r.match_score < lo || r.match_score > hi) {
    return { ok: false, error: `verdict ${r.verdict} contradicts score ${r.match_score}` };
  }
  const allowed = new Map(ctx.allowedPreferences.map((p) => [p.toLowerCase(), p]));
  const matched = [...new Set(r.matched_preferences.map((p) => allowed.get(p.toLowerCase())).filter((p): p is string => !!p))];
  const cap = ctx.confidenceCap.get(r.title_id) ?? "low";
  const confidence = RANK[r.confidence] <= RANK[cap] ? r.confidence : cap;
  return { ok: true, value: { ...r, matched_preferences: matched, confidence } };
}

/** JSON schema handed to Gemini's structured output. */
export const geminiResponseSchema = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title_id: { type: "string" },
          synopsis: { type: "string" },
          verdict: { type: "string", enum: ["watch", "maybe", "skip"] },
          match_score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          matched_preferences: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["title_id", "synopsis", "verdict", "match_score", "reason", "matched_preferences", "confidence"],
      },
    },
  },
  required: ["recommendations"],
} as const;
