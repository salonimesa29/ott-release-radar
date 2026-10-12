import { isAuthorizedCron } from "@/lib/auth/cron";
import { runWeeklyDigest } from "@/services/digest.service";

export const maxDuration = 300;

/**
 * Weekly digest. Vercel Cron calls this daily at 12:30 UTC (= 18:00 IST); it delivers to users
 * whose digest day is today in Asia/Kolkata (Friday by default). Schedule lives in vercel.json.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await runWeeklyDigest({ trigger: "cron" }));
  } catch (err) {
    console.error("weekly digest failed", err);
    return Response.json({ error: "Weekly digest failed" }, { status: 500 });
  }
}
