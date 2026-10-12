import { isAuthorizedCron } from "@/lib/auth/cron";
import { refreshReleases } from "@/services/releases.service";

export const maxDuration = 300;

/** Daily release refresh. Schedule lives in vercel.json. Requires Authorization: Bearer $CRON_SECRET. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await refreshReleases({ trigger: "cron" }));
  } catch (err) {
    console.error("cron refresh failed", err);
    return Response.json({ error: "Refresh failed" }, { status: 500 });
  }
}
