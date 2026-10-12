import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { MoodKey } from "@/config/taxonomy";
import { env } from "@/lib/env";
import { metadataConfidence } from "@/lib/ranking/signals";
import type { CatalogueItem, Preferences, Recommendation } from "@/types/domain";
import { NO_SYNOPSIS, buildPrompt, preferenceLabels } from "./prompt";
import { batchSchema, geminiResponseSchema, validateRecommendation } from "./schema";

const BATCH_SIZE = 15;
const MAX_ATTEMPTS = 2;

export class GeminiError extends Error {
  constructor(message: string, public transient: boolean) {
    super(message);
    this.name = "GeminiError";
  }
}

function client() {
  const { GEMINI_API_KEY, GEMINI_MODEL } = env("gemini");
  return { ai: new GoogleGenAI({ apiKey: GEMINI_API_KEY }), model: GEMINI_MODEL };
}

/** Verifies the key and model exist without spending generation tokens. */
export async function geminiPing(): Promise<void> {
  const { ai, model } = client();
  await ai.models.get({ model });
}

export interface GenerationResult {
  recommendations: Recommendation[];
  rejected: { titleId: string; error: string }[];
  model: string;
}

/**
 * Score titles in validated batches. Items the model drops or gets wrong are retried once
 * in a follow-up batch; anything still invalid is reported, never fabricated.
 */
export async function generateRecommendations(
  items: CatalogueItem[],
  prefs: Preferences,
  opts: { mood: MoodKey | null; notInterestedTitles: string[] },
): Promise<GenerationResult> {
  const { ai, model } = client();
  const out: Recommendation[] = [];
  const rejected = new Map<string, string>();

  let pending = items;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
    const failed: CatalogueItem[] = [];
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const { valid, invalid } = await runBatch(ai, model, batch, prefs, opts);
      out.push(...valid);
      for (const [id, err] of invalid) {
        rejected.set(id, err);
        failed.push(batch.find((b) => b.title.id === id)!);
      }
    }
    pending = failed;
  }
  for (const r of out) rejected.delete(r.titleId);
  return { recommendations: out, rejected: [...rejected].map(([titleId, error]) => ({ titleId, error })), model };
}

async function runBatch(
  ai: GoogleGenAI,
  model: string,
  batch: CatalogueItem[],
  prefs: Preferences,
  opts: { mood: MoodKey | null; notInterestedTitles: string[] },
) {
  const { system, user } = buildPrompt(batch, prefs, opts.mood, opts.notInterestedTitles);
  let text: string;
  try {
    const res = await ai.models.generateContent({
      model,
      contents: user,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: geminiResponseSchema,
        temperature: 0.4,
        httpOptions: { timeout: 45_000 },
      },
    });
    text = res.text ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|timeout|deadline/i.test(msg);
    throw new GeminiError(transient ? `Gemini is busy or rate-limited: ${msg}` : `Gemini request failed: ${msg}`, transient);
  }

  const invalid = new Map<string, string>();
  let rawItems: unknown[];
  try {
    rawItems = batchSchema.parse(JSON.parse(text)).recommendations;
  } catch {
    batch.forEach((b) => invalid.set(b.title.id, "malformed JSON from model"));
    return { valid: [], invalid };
  }

  const ctx = {
    titleIds: new Set(batch.map((b) => b.title.id)),
    allowedPreferences: preferenceLabels(prefs, opts.mood),
    confidenceCap: new Map(batch.map((b) => [b.title.id, metadataConfidence(b.title)])),
  };
  const now = new Date().toISOString();
  const valid: Recommendation[] = [];
  const seen = new Set<string>();
  for (const raw of rawItems) {
    const v = validateRecommendation(raw, ctx);
    if (!v.ok) {
      const id = (raw as { title_id?: string })?.title_id;
      if (id && ctx.titleIds.has(id)) invalid.set(id, v.error);
      continue;
    }
    if (seen.has(v.value.title_id)) continue;
    seen.add(v.value.title_id);
    const item = batch.find((b) => b.title.id === v.value.title_id)!;
    valid.push({
      titleId: v.value.title_id,
      matchScore: v.value.match_score,
      verdict: v.value.verdict,
      // Never let the model describe a plot TMDB didn't give us.
      synopsis: item.title.overview ? v.value.synopsis : NO_SYNOPSIS,
      explanation: v.value.reason,
      matchedPreferences: v.value.matched_preferences,
      confidence: v.value.confidence,
      modelName: model,
      generatedAt: now,
    });
  }
  for (const b of batch) if (!seen.has(b.title.id) && !invalid.has(b.title.id)) invalid.set(b.title.id, "missing from model output");
  return { valid, invalid };
}
