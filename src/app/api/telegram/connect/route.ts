import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { TelegramError } from "@/lib/telegram/client";
import { disconnectTelegram, startTelegramConnection, telegramStatus } from "@/services/telegram.service";

export async function GET() {
  try {
    const { user } = await requireUser();
    return Response.json(await telegramStatus(user.id));
  } catch (err) {
    return apiError(err);
  }
}

/** Issue a one-time deep link for the bot. */
export async function POST() {
  try {
    const { user } = await requireUser();
    return Response.json(await startTelegramConnection(user.id));
  } catch (err) {
    if (err instanceof TelegramError) return Response.json({ error: "Couldn't reach the Telegram bot. Check TELEGRAM_BOT_TOKEN." }, { status: 502 });
    return apiError(err);
  }
}

export async function DELETE() {
  try {
    const { user } = await requireUser();
    return Response.json(await disconnectTelegram(user.id));
  } catch (err) {
    return apiError(err);
  }
}
