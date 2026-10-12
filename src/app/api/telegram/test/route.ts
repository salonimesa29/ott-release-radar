import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { sendTestDigest } from "@/services/digest.service";

export const maxDuration = 120;

/** Sends a real test digest. "sent" only when Telegram accepted every message. */
export async function POST() {
  try {
    const { user } = await requireUser();
    const result = await sendTestDigest(user.id);
    const status = result.ok ? 200 : result.status === "skipped" ? 429 : result.status === "partial" ? 207 : 502;
    return Response.json(result, { status });
  } catch (err) {
    return apiError(err);
  }
}
