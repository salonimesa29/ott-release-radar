import "server-only";
import { randomBytes } from "node:crypto";
import { activeLinkCode, consumeLinkCode, createLinkCode, recordIntegration } from "@/lib/db/ops";
import { getPreferences, setTelegramChat } from "@/lib/db/users";
import { createAdminClient } from "@/lib/supabase/server";
import { TelegramError, getMe, getUpdates, sendMessage } from "@/lib/telegram/client";

const CODE_TTL_MS = 30 * 60 * 1000;

/** Step 1: issue a one-time code and a deep link (t.me/<bot>?start=<code>). */
export async function startTelegramConnection(userId: string) {
  const admin = createAdminClient();
  const bot = await getMe();
  const code = (await activeLinkCode(admin, userId)) ?? randomBytes(9).toString("base64url");
  await createLinkCode(admin, userId, code, CODE_TTL_MS);
  return { botUsername: bot.username, code, deepLink: `https://t.me/${bot.username}?start=${code}`, expiresInMinutes: CODE_TTL_MS / 60000 };
}

/** Pure: find the private chat that sent "/start <code>". */
export function findChatForCode(updates: Awaited<ReturnType<typeof getUpdates>>, code: string) {
  for (const u of [...updates].reverse()) {
    const text = u.message?.text?.trim();
    if (u.message && u.message.chat.type === "private" && (text === `/start ${code}` || text === code)) {
      return { id: u.message.chat.id, username: u.message.chat.username ?? null };
    }
  }
  return null;
}

/**
 * Step 2: verify. The chat ID is taken from Telegram's own update for our one-time code —
 * the user never types a chat ID, so it can't be spoofed.
 */
export async function verifyTelegramConnection(userId: string) {
  const admin = createAdminClient();
  const code = await activeLinkCode(admin, userId);
  if (!code) return { connected: false, message: "Your connection code expired. Start again." };

  let chat: { id: number; username: string | null } | null;
  try {
    chat = findChatForCode(await getUpdates(), code);
  } catch (err) {
    const msg = err instanceof TelegramError && /webhook/i.test(err.message)
      ? "This bot has a webhook set, so updates can't be read. Remove the webhook (deleteWebhook) and retry."
      : `Couldn't read messages from Telegram: ${err instanceof Error ? err.message : String(err)}`;
    await recordIntegration(admin, "telegram", false, msg);
    return { connected: false, message: msg };
  }
  if (!chat) return { connected: false, message: "We haven't seen your /start message yet. Open the bot, tap Start, then verify again." };

  await setTelegramChat(admin, userId, chat);
  await consumeLinkCode(admin, code);
  await recordIntegration(admin, "telegram", true);
  try {
    await sendMessage(chat.id, "✅ <b>OTT Release Radar is connected.</b>\nYour weekly digest will arrive here.");
  } catch {
    // Connection is verified even if the welcome message fails.
  }
  return { connected: true, message: "Telegram connected.", username: chat.username };
}

export async function disconnectTelegram(userId: string) {
  const admin = createAdminClient();
  await setTelegramChat(admin, userId, null);
  return { connected: false };
}

export async function telegramStatus(userId: string) {
  const admin = createAdminClient();
  const prefs = await getPreferences(admin, userId);
  const pendingCode = prefs.telegramConnected ? null : await activeLinkCode(admin, userId);
  return { connected: prefs.telegramConnected, username: prefs.telegramUsername, pending: !!pendingCode };
}
