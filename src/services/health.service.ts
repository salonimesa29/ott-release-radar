import "server-only";
import { isConfigured, type EnvGroup } from "@/lib/env";
import { geminiPing } from "@/lib/gemini/client";
import { listIntegrations, recordIntegration } from "@/lib/db/ops";
import { createAdminClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/telegram/client";
import { tmdbPing } from "@/lib/tmdb/client";
import type { IntegrationHealth, IntegrationName } from "@/types/domain";

const RECHECK_MS = 5 * 60 * 1000;

const CHECKS: Record<Exclude<IntegrationName, "supabase">, { group: EnvGroup; ping: () => Promise<unknown> }> = {
  tmdb: { group: "tmdb", ping: tmdbPing },
  gemini: { group: "gemini", ping: geminiPing },
  telegram: { group: "telegram", ping: getMe },
};

/**
 * Real health checks (an authenticated call to each service), cached for 5 minutes.
 * A key merely existing is never reported as "ok".
 */
export async function integrationHealth(force = false): Promise<IntegrationHealth[]> {
  const admin = createAdminClient();
  const stored = new Map((await listIntegrations(admin)).map((i) => [i.name, i]));
  await recordIntegration(admin, "supabase", true);

  await Promise.all(
    (Object.keys(CHECKS) as (keyof typeof CHECKS)[]).map(async (name) => {
      const prev = stored.get(name);
      const fresh = prev?.lastCheckedAt && Date.now() - new Date(prev.lastCheckedAt).getTime() < RECHECK_MS;
      if (!isConfigured(CHECKS[name].group)) return recordIntegration(admin, name, "unconfigured");
      if (fresh && !force && prev.status !== "unconfigured") return;
      try {
        await CHECKS[name].ping();
        await recordIntegration(admin, name, true);
      } catch (err) {
        await recordIntegration(admin, name, false, err instanceof Error ? err.message : String(err));
      }
    }),
  );
  const order: IntegrationName[] = ["supabase", "tmdb", "gemini", "telegram"];
  const latest = new Map((await listIntegrations(admin)).map((i) => [i.name, i]));
  return order.map((n) => latest.get(n) ?? { name: n, status: "unknown", lastCheckedAt: null, lastSuccessAt: null, lastErrorAt: null, lastErrorMessage: null });
}
