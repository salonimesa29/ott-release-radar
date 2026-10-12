import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/env";
import { istDate, istWeekday, releaseWindow } from "@/lib/dates/ist";
import { finishRun, recordIntegration, startRun } from "@/lib/db/ops";
import {
  claimDigest,
  getPreferences,
  listDigestHistory,
  listDigestRecipients,
  listNotInterested,
  updateDigest,
} from "@/lib/db/users";
import { digestKey, selectDigestItems } from "@/lib/ranking/digest-select";
import { createAdminClient } from "@/lib/supabase/server";
import { TELEGRAM_ERROR_HELP, TelegramError, sendMessage } from "@/lib/telegram/client";
import { buildDigestMessages } from "@/lib/telegram/format";
import type { CatalogueItem, DigestRecord, Preferences, ReleaseWindow } from "@/types/domain";
import { getCatalogue } from "./catalogue.service";
import { ensureRecommendations } from "./recommendations.service";
import { refreshReleases } from "./releases.service";

export interface BuiltDigest {
  window: ReleaseWindow;
  items: CatalogueItem[];
  messages: string[];
  aiError: string | null;
  eligibleCount: number;
}

/** Build a user's digest from stored releases + (cached or freshly generated) Gemini recommendations. */
export async function buildDigest(admin: SupabaseClient, userId: string, prefs: Preferences, opts: { test?: boolean; now?: Date } = {}): Promise<BuiltDigest> {
  const catalogue = await getCatalogue(admin, userId, prefs, null, opts.now);
  const ai = await ensureRecommendations({ admin, userId, prefs, items: catalogue.items, mood: null });
  const exclude = new Set(prefs.useFeedback ? await listNotInterested(admin, userId) : []);
  const items = selectDigestItems(ai.items, prefs, exclude);
  return {
    window: catalogue.window,
    items,
    messages: buildDigestMessages(items, catalogue.window, { test: opts.test }),
    aiError: ai.error,
    eligibleCount: ai.items.filter((i) => i.verified).length,
  };
}

/** Preview: build, record as "preview", never send. */
export async function previewDigest(userId: string): Promise<BuiltDigest> {
  const admin = createAdminClient();
  const prefs = await getPreferences(admin, userId);
  const digest = await buildDigest(admin, userId, prefs);
  const { record } = await claimDigest(admin, {
    userId,
    kind: "preview",
    periodStart: digest.window.start,
    periodEnd: digest.window.end,
    key: digestKey("preview", userId, digest.window.start),
    status: "preview",
  });
  await updateDigest(admin, record.id, {
    titleCount: digest.items.length,
    recommendedCount: digest.items.filter((i) => i.recommendation?.verdict === "watch").length,
    messagePreview: digest.messages.join("\n\n"),
    messageChunks: digest.messages,
  });
  return digest;
}

/**
 * Send chunks starting at `from`, recording progress after each accepted message so a retry
 * resumes instead of duplicating. Status is "sent" only when Telegram accepted every chunk.
 */
async function deliver(admin: SupabaseClient, record: DigestRecord, chatId: number, chunks: string[], from: number) {
  const ids = [...record.telegramMessageIds];
  let sent = from;
  try {
    for (let i = from; i < chunks.length; i++) {
      ids.push(await sendMessage(chatId, chunks[i]));
      sent = i + 1;
      await updateDigest(admin, record.id, { chunksSent: sent, telegramMessageIds: ids, status: sent === chunks.length ? "sent" : "partial", ...(sent === chunks.length ? { sentAt: new Date().toISOString(), errorMessage: null } : {}) });
    }
    await recordIntegration(admin, "telegram", true);
    return { status: "sent" as const, error: null };
  } catch (err) {
    const kind = err instanceof TelegramError ? err.kind : "network";
    const message = `${TELEGRAM_ERROR_HELP[kind]}${err instanceof Error ? ` (${err.message})` : ""}`;
    const status = sent > 0 ? ("partial" as const) : ("failed" as const);
    await updateDigest(admin, record.id, { status, errorMessage: message.slice(0, 500), chunksSent: sent, telegramMessageIds: ids });
    await recordIntegration(admin, "telegram", false, message);
    return { status, error: message, kind };
  }
}

const TEST_COOLDOWN_MS = 60_000;

/** "Send Test Digest" from Settings: a real Telegram message, recorded as kind "test". */
export async function sendTestDigest(userId: string) {
  if (!isConfigured("telegram")) return { ok: false, status: "failed", error: "Telegram isn't configured on the server (TELEGRAM_BOT_TOKEN)." };
  const admin = createAdminClient();
  const prefs = await getPreferences(admin, userId);
  if (!prefs.telegramConnected || !prefs.telegramChatId) return { ok: false, status: "failed", error: "Connect Telegram first." };

  const recent = (await listDigestHistory(admin, userId, 5)).find((d) => d.kind === "test");
  if (recent && Date.now() - new Date(recent.createdAt).getTime() < TEST_COOLDOWN_MS) {
    return { ok: false, status: "skipped", error: "A test was just sent. Wait a minute before sending another." };
  }

  const digest = await buildDigest(admin, userId, prefs, { test: true });
  const { record } = await claimDigest(admin, {
    userId,
    kind: "test",
    periodStart: digest.window.start,
    periodEnd: digest.window.end,
    key: `test:${userId}:${Date.now()}`,
    status: "pending",
  });
  await updateDigest(admin, record.id, {
    chunksTotal: digest.messages.length,
    titleCount: digest.items.length,
    recommendedCount: digest.items.filter((i) => i.recommendation?.verdict === "watch").length,
    messagePreview: digest.messages.join("\n\n"),
    messageChunks: digest.messages,
  });
  const result = await deliver(admin, record, prefs.telegramChatId, digest.messages, 0);
  return { ok: result.status === "sent", status: result.status, error: result.error, titles: digest.items.length, aiError: digest.aiError };
}

/** Weekly delivery for one user. Idempotent per user × window. */
export async function deliverWeekly(admin: SupabaseClient, userId: string, prefs: Preferences, now: Date) {
  const window = releaseWindow(now);
  const { record, created } = await claimDigest(admin, {
    userId,
    kind: "weekly",
    periodStart: window.start,
    periodEnd: window.end,
    key: digestKey("weekly", userId, window.start),
    status: "pending",
  });
  if (!created && record.status === "sent") return { userId, status: "already_sent" as const };
  if (!created && record.status === "pending" && Date.now() - new Date(record.createdAt).getTime() < 10 * 60_000) {
    return { userId, status: "in_progress" as const };
  }

  // Resume a partial delivery with the exact same messages; otherwise build fresh.
  let chunks = record.messageChunks;
  let from = record.chunksSent;
  if (record.status !== "partial" || !chunks.length) {
    const digest = await buildDigest(admin, userId, prefs, { now });
    chunks = digest.messages;
    from = 0;
    await updateDigest(admin, record.id, {
      status: "pending",
      chunksTotal: chunks.length,
      chunksSent: 0,
      telegramMessageIds: [],
      titleCount: digest.items.length,
      recommendedCount: digest.items.filter((i) => i.recommendation?.verdict === "watch").length,
      messagePreview: chunks.join("\n\n"),
      messageChunks: chunks,
      errorMessage: digest.aiError,
    });
    record.telegramMessageIds = [];
  }
  const result = await deliver(admin, record, prefs.telegramChatId!, chunks, from);
  return { userId, status: result.status, error: result.error };
}

/** Scheduled weekly digest: refresh, then deliver to every user whose digest day is today (IST). */
export async function runWeeklyDigest(opts: { trigger: "cron" | "manual"; now?: Date }) {
  const now = opts.now ?? new Date();
  const admin = createAdminClient();
  const run = await startRun(admin, "weekly_digest", `weekly_digest:${istDate(now)}`, opts.trigger, 15 * 60_000);
  if (!run) return { status: "skipped", message: "Today's digest run already happened or is in progress." };

  try {
    const refresh = await refreshReleases({ trigger: "cron", now });
    const recipients = isConfigured("telegram") ? await listDigestRecipients(admin, istWeekday(now)) : [];
    const results = [];
    for (const r of recipients) {
      try {
        results.push(await deliverWeekly(admin, r.userId, r.prefs, now));
      } catch (err) {
        results.push({ userId: r.userId, status: "failed" as const, error: err instanceof Error ? err.message : String(err) });
      }
    }
    const failed = results.filter((r) => r.status === "failed" || r.status === "partial").length;
    const summary = {
      refresh: { status: refresh.status, message: refresh.message },
      recipients: recipients.length,
      sent: results.filter((r) => r.status === "sent").length,
      alreadySent: results.filter((r) => r.status === "already_sent").length,
      failed,
      telegramConfigured: isConfigured("telegram"),
    };
    const status = failed && failed === results.length ? "failed" : failed ? "partial" : "succeeded";
    await finishRun(admin, run.id, { status, processed: results.length, failed, summary, error: failed ? `${failed} deliveries failed` : null });
    return { status, ...summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishRun(admin, run.id, { status: "failed", processed: 0, failed: 0, summary: {}, error: message.slice(0, 500) });
    throw err;
  }
}
