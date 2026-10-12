import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { integrationHealth } from "@/services/health.service";

export async function GET(req: Request) {
  try {
    await requireUser();
    const force = new URL(req.url).searchParams.get("force") === "1";
    return Response.json({ integrations: await integrationHealth(force) });
  } catch (err) {
    return apiError(err);
  }
}
