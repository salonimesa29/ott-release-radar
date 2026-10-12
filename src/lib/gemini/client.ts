import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { MoodKey } from "@/config/taxonomy";
import { env } from "@/lib/env";
import { mapLimit } from "@/lib/http";
import { metadataConfidence } from "@/lib/ranking/signals";
import type { CatalogueItem, Preferences, Recommendation } from "@/types/domain";
import { NO_SYNOPSIS, buildPrompt, preferenceLabels } from "./prompt";
import { batchSchema, geminiResponseSchema, validateRecommendation } from "./schema";

// Sequential batches keep us inside free-tier per-minute quotas.
const BATCH_SIZE = 12;
const CONCURRENCY = 1;
const FALLBACK_PAUSE_MS = 4000;
const MAX_ATTEMPTS = 2;

export class GeminiError extends Error {
  constructor(message: string, public transient: boolean) {
    super(message);
    this.name = "GeminiError";
  }
}

function client() {
  const { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODEL } = env("gemini");
  const models = [GEMINI_MODEL, ...(GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL ? [GEMINI_FALLBACK_MODEL] : [])];
  return { ai: new GoogleGenAI({ apiKey: GEMINI_API_KEY }), model: GEMINI_MODEL, models };
}

const TRANSIENT = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|504|DEADLINE_EXCEEDED|timeout|deadline/i;

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
  const { ai, models } = client();
  const out: Recommendation[] = [];
  const rejected = new Map<string, string>();

  let pending = items;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
    const failed: CatalogueItem[] = [];
    const batches: CatalogueItem[][] = [];
    for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE));
    const settled = await mapLimit(batches, CONCURRENCY, (batch) => runBatch(ai, models, batch, prefs, opts));
    const errors = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    // Every batch failed (e.g. Gemini down): surface the error so the caller can report it.
    if (errors.length === settled.length) throw errors[0].reason;
    settled.forEach((r, i) => {
      if (r.status === "rejected") {
        batches[i].forEach((b) => rejected.set(b.title.id, String(r.reason?.message ?? r.reason)));
        return;
      }
      out.push(...r.value.valid);
      for (const [id, err] of r.value.invalid) {
        rejected.set(id, err);
        failed.push(batches[i].find((b) => b.title.id === id)!);
      }
    });
    pending = failed;
  }
  for (const r of out) rejected.delete(r.titleId);
  return { recommendations: out, rejected: [...rejected].map(([titleId, error]) => ({ titleId, error })), model: models[0] };
}

async function runBatch(
  ai: GoogleGenAI,
  models: string[],
  batch: CatalogueItem[],
  prefs: Preferences,
  opts: { mood: MoodKey | null; notInterestedTitles: string[] },
) {
  const { system, user } = buildPrompt(batch, prefs, opts.mood, opts.notInterestedTitles);
  let text = "";
  let model = models[0];
  for (let m = 0; m < models.length; m++) {
    model = models[m];
    try {
      text = await generate(ai, model, system, user);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const transient = TRANSIENT.test(msg);
      // Busy/rate-limited: try the fallback Flash model before giving up.
      if (transient && m < models.length - 1) {
        await new Promise((r) => setTimeout(r, FALLBACK_PAUSE_MS));
        continue;
      }
      throw new GeminiError(transient ? `Gemini is busy or rate-limited: ${msg}` : `Gemini request failed: ${msg}`, transient);
    }
  }
  return parseBatch(text, model, batch, prefs, opts);
}

async function generate(ai: GoogleGenAI, model: string, system: string, user: string): Promise<string> {
  {
    const res = await ai.models.generateContent({
      model,
      contents: user,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        responseJsonSchema: geminiResponseSchema,
        temperature: 0.4,
        // Scoring is structured extraction; deep reasoning only adds latency.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        httpOptions: { timeout: 50_000 },
      },
    });
    return res.text ?? "";
  }
}

function parseBatch(
  text: string,
  model: string,
  batch: CatalogueItem[],
  prefs: Preferences,
  opts: { mood: MoodKey | null; notInterestedTitles: string[] },
) {
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
