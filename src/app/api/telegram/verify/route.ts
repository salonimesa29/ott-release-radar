import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { verifyTelegramConnection } from "@/services/telegram.service";

export async function POST() {
  try {
    const { user } = await requireUser();
    const result = await verifyTelegramConnection(user.id);
    return Response.json(result, { status: result.connected ? 200 : 409 });
  } catch (err) {
    return apiError(err);
  }
}
