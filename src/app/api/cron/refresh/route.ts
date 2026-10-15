import { isAuthorizedCron } from "@/lib/auth/cron";
import { createAdminClient } from "@/lib/supabase/server";
import { prescoreAllUsers } from "@/services/recommendations.service";
import { refreshReleases } from "@/services/releases.service";

export const maxDuration = 300;

/** Daily release refresh. Schedule lives in vercel.json. Requires Authorization: Bearer $CRON_SECRET. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const refresh = await refreshReleases({ trigger: "cron" });
    // Score new titles for everyone now, so nobody opens the app to unscored cards.
    const ok = refresh.status === "succeeded" || refresh.status === "partial";
    const ai = ok ? await prescoreAllUsers(createAdminClient()) : null;
    return Response.json({ ...refresh, ai });
  } catch (err) {
    console.error("cron refresh failed", err);
    return Response.json({ error: "Refresh failed" }, { status: 500 });
  }
}
