import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { refreshReleases } from "@/services/releases.service";

export const maxDuration = 300;

/** Manual refresh (signed-in users; rate-limited to one run per 5 minutes across the app). */
export async function POST() {
  try {
    await requireUser();
    const summary = await refreshReleases({ trigger: "manual" });
    const status = summary.status === "skipped" ? 429 : summary.status === "failed" ? 502 : 200;
    return Response.json(summary, { status });
  } catch (err) {
    return apiError(err);
  }
}
