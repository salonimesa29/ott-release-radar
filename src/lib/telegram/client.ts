import "server-only";
import { env } from "@/lib/env";

type TgResponse<T> = { ok: true; result: T } | { ok: false; error_code: number; description: string; parameters?: { retry_after?: number } };

export type TelegramErrorKind = "invalid_chat" | "blocked" | "rate_limited" | "network" | "api";

export class TelegramError extends Error {
  constructor(
    public kind: TelegramErrorKind,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "TelegramError";
  }
}

/** Map a Telegram API error to a kind the UI can explain. */
export function classifyTelegramError(code: number, description: string): TelegramErrorKind {
  if (code === 429) return "rate_limited";
  if (code === 403) return "blocked"; // bot was blocked by the user / kicked
  if (code === 400 && /chat not found|chat_id is empty|user not found/i.test(description)) return "invalid_chat";
  return "api";
}

export const TELEGRAM_ERROR_HELP: Record<TelegramErrorKind, string> = {
  invalid_chat: "Telegram doesn't recognise this chat. Reconnect Telegram in Settings.",
  blocked: "The bot was blocked or removed. Unblock it in Telegram, then reconnect.",
  rate_limited: "Telegram is rate-limiting the bot. Try again in a minute.",
  network: "Couldn't reach Telegram. Check your connection and retry.",
  api: "Telegram rejected the message.",
};

async function call<T>(method: string, body: Record<string, unknown>, timeoutMs = 10_000): Promise<T> {
  const { TELEGRAM_BOT_TOKEN } = env("telegram");
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    throw new TelegramError("network", `Telegram ${method}: ${err instanceof Error ? err.message : String(err)}`);
  }
  let json: TgResponse<T>;
  try {
    json = (await res.json()) as TgResponse<T>;
  } catch {
    throw new TelegramError("api", `Telegram ${method}: HTTP ${res.status}`);
  }
  if (!json.ok) {
    throw new TelegramError(classifyTelegramError(json.error_code, json.description), `Telegram ${method}: ${json.description}`, json.parameters?.retry_after);
  }
  return json.result;
}

export async function getMe() {
  return call<{ id: number; username: string; first_name: string }>("getMe", {});
}

export async function sendMessage(chatId: number, html: string): Promise<number> {
  const send = () =>
    call<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  try {
    return (await send()).message_id;
  } catch (err) {
    // One bounded retry for rate limits / network blips.
    if (err instanceof TelegramError && (err.kind === "rate_limited" || err.kind === "network")) {
      await new Promise((r) => setTimeout(r, Math.min(err.retryAfter ?? 2, 10) * 1000));
      return (await send()).message_id;
    }
    throw err;
  }
}

export type TgUpdate = {
  update_id: number;
  message?: { text?: string; chat: { id: number; type: string; username?: string; first_name?: string } };
};

/** Recent bot updates (requires that no webhook is set on the bot). */
export async function getUpdates(): Promise<TgUpdate[]> {
  return call<TgUpdate[]>("getUpdates", { limit: 100, timeout: 0, allowed_updates: ["message"] });
}
