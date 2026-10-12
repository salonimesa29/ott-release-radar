import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationRun, IntegrationHealth, IntegrationName } from "@/types/domain";
import { toIntegration, toRun, type IntegrationRow, type RunRow } from "./mappers";

function fail(error: { message: string } | null, what: string) {
  if (error) throw new Error(`Database error while ${what}: ${error.message}`);
}

const RUN_COLS = "id,job_type,run_key,trigger,status,started_at,completed_at,records_processed,records_failed,summary,error_summary";

/**
 * Start a run guarded by a unique run_key. Returns null if a run with that key already
 * exists and is running or succeeded (duplicate/concurrent run). A failed run with the
 * same key is reclaimed so it can be retried.
 */
export async function startRun(
  admin: SupabaseClient,
  jobType: AutomationRun["jobType"],
  runKey: string,
  trigger: AutomationRun["trigger"],
  staleAfterMs = 10 * 60 * 1000,
): Promise<AutomationRun | null> {
  const { data, error } = await admin
    .from("automation_runs")
    .insert({ job_type: jobType, run_key: runKey, trigger, status: "running" })
    .select(RUN_COLS)
    .single();
  if (!error) return toRun(data as RunRow);
  if (error.code !== "23505") fail(error, "starting run");

  const { data: existing, error: readErr } = await admin.from("automation_runs").select(RUN_COLS).eq("run_key", runKey).single();
  fail(readErr, "reading run");
  const run = toRun(existing as RunRow);
  const stale = run.status === "running" && Date.now() - new Date(run.startedAt).getTime() > staleAfterMs;
  if (run.status !== "failed" && run.status !== "partial" && !stale) return null;

  // Reclaim atomically: only succeeds if the row is still in the state we saw.
  const { data: reclaimed, error: upErr } = await admin
    .from("automation_runs")
    .update({ status: "running", trigger, started_at: new Date().toISOString(), completed_at: null, error_summary: null })
    .eq("id", run.id)
    .eq("status", run.status)
    .select(RUN_COLS)
    .maybeSingle();
  fail(upErr, "reclaiming run");
  return reclaimed ? toRun(reclaimed as RunRow) : null;
}

export async function finishRun(
  admin: SupabaseClient,
  id: string,
  result: { status: AutomationRun["status"]; processed: number; failed: number; summary: Record<string, unknown>; error?: string | null },
) {
  const { error } = await admin
    .from("automation_runs")
    .update({
      status: result.status,
      completed_at: new Date().toISOString(),
      records_processed: result.processed,
      records_failed: result.failed,
      summary: result.summary,
      error_summary: result.error ?? null,
    })
    .eq("id", id);
  fail(error, "finishing run");
}

export async function latestRuns(db: SupabaseClient, jobType: AutomationRun["jobType"], limit = 5): Promise<AutomationRun[]> {
  const { data, error } = await db
    .from("automation_runs")
    .select(RUN_COLS)
    .eq("job_type", jobType)
    .order("started_at", { ascending: false })
    .limit(limit);
  fail(error, "loading runs");
  return ((data ?? []) as RunRow[]).map(toRun);
}

export async function lastSuccessfulRun(db: SupabaseClient, jobType: AutomationRun["jobType"]): Promise<AutomationRun | null> {
  const { data, error } = await db
    .from("automation_runs")
    .select(RUN_COLS)
    .eq("job_type", jobType)
    .in("status", ["succeeded", "partial"])
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error, "loading last run");
  return data ? toRun(data as RunRow) : null;
}

/* ---------- Integration status ---------- */

export async function recordIntegration(admin: SupabaseClient, name: IntegrationName, ok: boolean | "unconfigured", message?: string) {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    integration_name: name,
    status: ok === "unconfigured" ? "unconfigured" : ok ? "ok" : "error",
    last_checked_at: now,
  };
  if (ok === true) row.last_success_at = now;
  if (ok === false) {
    row.last_error_at = now;
    row.last_error_message = (message ?? "Unknown error").slice(0, 500);
  }
  const { error } = await admin.from("integration_status").upsert(row, { onConflict: "integration_name" });
  if (error) console.error("integration_status write failed", error.message);
}

export async function listIntegrations(db: SupabaseClient): Promise<IntegrationHealth[]> {
  const { data, error } = await db
    .from("integration_status")
    .select("integration_name,status,last_checked_at,last_success_at,last_error_at,last_error_message");
  fail(error, "loading integrations");
  return ((data ?? []) as IntegrationRow[]).map(toIntegration);
}

/* ---------- Telegram link codes ---------- */

export async function createLinkCode(admin: SupabaseClient, userId: string, code: string, ttlMs: number) {
  await admin.from("telegram_link_codes").delete().eq("user_id", userId).is("used_at", null);
  const { error } = await admin
    .from("telegram_link_codes")
    .insert({ code, user_id: userId, expires_at: new Date(Date.now() + ttlMs).toISOString() });
  fail(error, "creating Telegram link code");
}

export async function activeLinkCode(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("telegram_link_codes")
    .select("code")
    .eq("user_id", userId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error, "loading Telegram link code");
  return (data?.code as string | undefined) ?? null;
}

export async function consumeLinkCode(admin: SupabaseClient, code: string) {
  const { error } = await admin.from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("code", code);
  fail(error, "consuming Telegram link code");
}
