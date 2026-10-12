"use client";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/dates/ist";

/** Data freshness + refresh / AI controls with loading, success and error states. */
export function SyncBar({
  lastSyncedAt,
  lastRefreshFailed,
  refreshState,
  onRefresh,
  unscored,
  aiState,
  aiError,
  onGenerate,
}: {
  lastSyncedAt: string | null;
  lastRefreshFailed: boolean;
  refreshState: "idle" | "loading" | "success" | "error";
  onRefresh: () => void;
  unscored: number;
  aiState: "idle" | "loading";
  aiError: string | null;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        {lastRefreshFailed ? <AlertTriangle className="size-3.5 text-maybe" /> : <span className="size-1.5 rounded-full bg-watch" />}
        Last synced: {lastSyncedAt ? formatTimestamp(lastSyncedAt) + " IST" : "never"}
        {lastRefreshFailed && <span className="text-maybe">· latest refresh failed, showing last good data</span>}
      </span>
      <Button variant="ghost" size="xs" onClick={onRefresh} disabled={refreshState === "loading"} aria-live="polite">
        {refreshState === "loading" ? <Loader2 className="animate-spin" /> : refreshState === "success" ? <CheckCircle2 className="text-watch" /> : <RefreshCw />}
        {refreshState === "loading" ? "Refreshing…" : refreshState === "error" ? "Retry refresh" : "Refresh Releases"}
      </Button>
      {unscored > 0 && (
        <Button variant="ghost" size="xs" onClick={onGenerate} disabled={aiState === "loading"} className="text-violet">
          {aiState === "loading" ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {aiState === "loading" ? "Gemini is scoring…" : `Get AI verdicts (${unscored})`}
        </Button>
      )}
      {aiError && <span className="text-maybe">{aiError}</span>}
    </div>
  );
}
