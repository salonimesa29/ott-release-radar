import "server-only";
import { releaseWindow } from "./dates";
import { judge } from "./gemini";
import { sampleCandidates } from "./sample";
import { getDigest, getPreferences, insertDigest, markSent } from "./store";
import { formatDigest, sendTelegram } from "./telegram";
import { fetchNewReleases, hasTmdb } from "./tmdb";
import type { Digest } from "./types";

/** Pull this week's releases, score them with Gemini, and save the digest. */
export async function generateDigest(): Promise<Digest> {
  const prefs = await getPreferences();
  const window = releaseWindow(prefs.windowDays);
  const live = hasTmdb();
  const candidates = live ? await fetchNewReleases(prefs, window) : sampleCandidates(window);
  const items = await judge(candidates, prefs);
  return insertDigest({
    windowStart: window.start,
    windowEnd: window.end,
    source: live ? "tmdb" : "sample",
    items,
    sent: false,
    sentAt: null,
    telegramError: null,
  });
}

/** Send a saved digest to Telegram and record the outcome. */
export async function deliverDigest(id: string): Promise<Digest> {
  const [digest, prefs] = await Promise.all([getDigest(id), getPreferences()]);
  if (!digest) throw new Error("Digest not found");
  const chatId = prefs.telegramChatId || process.env.TELEGRAM_CHAT_ID;
  let error: string | null = null;
  try {
    if (!chatId) throw new Error("No Telegram chat ID set");
    await sendTelegram(chatId, formatDigest(digest));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await markSent(id, error);
  return (await getDigest(id))!;
}
