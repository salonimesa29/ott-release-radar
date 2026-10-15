import "server-only";
import { isConfigured } from "@/lib/env";
import { istDate, releaseWindow } from "@/lib/dates/ist";
import { upsertReleases, upsertTitles } from "@/lib/db/catalogue";
import { finishRun, recordIntegration, startRun } from "@/lib/db/ops";
import type { ReleaseSourceAdapter } from "@/lib/release/types";
import { createAdminClient } from "@/lib/supabase/server";
import { TmdbReleaseAdapter } from "@/lib/tmdb/adapter";
import type { ReleaseWindow } from "@/types/domain";

export interface RefreshSummary {
  status: "succeeded" | "partial" | "failed" | "skipped";
  window: ReleaseWindow;
  examined: number;
  titlesUpserted: number;
  titlesChanged: number;
  releasesUpserted: number;
  verified: number;
  unverified: number;
  failures: number;
  message: string;
  runId: string | null;
}

const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Release refresh pipeline: IST window → TMDB → validate/normalize/dedupe → upsert → log.
 * Idempotent (upserts on unique keys). A failed fetch never deletes existing data.
 */
export async function refreshReleases(opts: { trigger: "cron" | "manual"; now?: Date; adapter?: ReleaseSourceAdapter }): Promise<RefreshSummary> {
  const now = opts.now ?? new Date();
  const window = releaseWindow(now);
  const admin = createAdminClient();
  const empty = { window, examined: 0, titlesUpserted: 0, titlesChanged: 0, releasesUpserted: 0, verified: 0, unverified: 0, failures: 0, runId: null };

  if (!isConfigured("tmdb")) {
    await recordIntegration(admin, "tmdb", "unconfigured");
    return { ...empty, status: "failed", message: "TMDB isn't configured. Set TMDB_API_KEY to load live releases." };
  }

  // Cron: one run per IST day. Manual: one run per 5-minute bucket (rate limit).
  const runKey =
    opts.trigger === "cron"
      ? `release_refresh:${istDate(now)}`
      : `release_refresh:manual:${Math.floor(now.getTime() / MANUAL_COOLDOWN_MS)}`;
  const run = await startRun(admin, "release_refresh", runKey, opts.trigger);
  if (!run) {
    return { ...empty, status: "skipped", message: "A refresh already ran or is running for this period. Try again in a few minutes." };
  }

  try {
    // Ask the adapter for the union of every user's languages so regional titles aren't crowded out.
    const { data: langRows } = await admin.from("user_preferences").select("preferred_languages");
    const languages = [...new Set((langRows ?? []).flatMap((r) => r.preferred_languages as string[]))];

    const adapter = opts.adapter ?? new TmdbReleaseAdapter({ languages });
    let result;
    try {
      result = await adapter.fetchWindow(window);
    } catch (err) {
      throw Object.assign(err instanceof Error ? err : new Error(String(err)), { source: "tmdb" as const });
    }
    await recordIntegration(admin, "tmdb", true);

    const { ids, changed } = await upsertTitles(admin, result.records.map((r) => r.title));
    const releases = result.records.flatMap((r) =>
      r.releases.map((rel) => ({ ...rel, titleId: ids.get(`${r.title.mediaType}:${r.title.tmdbId}`)! })),
    ).filter((r) => r.titleId);
    const releasesUpserted = await upsertReleases(admin, releases);

    const verified = result.records.filter((r) => r.releases.some((x) => x.status === "verified")).length;
    const summary: RefreshSummary = {
      status: result.failures.length ? "partial" : "succeeded",
      window,
      examined: result.examined,
      titlesUpserted: ids.size,
      titlesChanged: changed,
      releasesUpserted,
      verified,
      unverified: result.records.length - verified,
      failures: result.failures.length,
      message: result.records.length
        ? `Synced ${result.records.length} titles (${verified} verified new on OTT in India).`
        : "TMDB returned no eligible releases for this window.",
      runId: run.id,
    };
    await finishRun(admin, run.id, {
      status: summary.status,
      processed: result.records.length,
      failed: result.failures.length,
      summary: { ...summary, failureSamples: result.failures.slice(0, 5), source: adapter.name },
    });
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Release refresh failed", err);
    await finishRun(admin, run.id, { status: "failed", processed: 0, failed: 0, summary: { window }, error: message.slice(0, 500) });
    const fromTmdb = (err as { source?: string })?.source === "tmdb";
    await recordIntegration(admin, fromTmdb ? "tmdb" : "supabase", false, message);
    return {
      ...empty,
      runId: run.id,
      status: "failed",
      message: fromTmdb ? "Couldn't reach TMDB. Showing the last successful data." : "Couldn't save the new releases. Showing the last successful data.",
    };
  }
}
