"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MoodKey, WatchStatus } from "@/config/taxonomy";
import { api } from "@/lib/client-api";
import { scoringExclusion } from "@/lib/ranking/signals";
import type { CatalogueItem, Preferences } from "@/types/domain";

type RefreshState = "idle" | "loading" | "success" | "error";

/** Client state for the release catalogue: watchlist edits, refresh, and AI generation. */
export function useCatalogue(initial: CatalogueItem[], prefs: Preferences, opts: { autoScore?: boolean } = {}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [aiState, setAiState] = useState<"idle" | "loading">("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const setWatchStatus = useCallback((titleId: string, status: WatchStatus | null) => {
    setItems((prev) => prev.map((i) => (i.title.id === titleId ? { ...i, watchStatus: status } : i)));
  }, []);

  const generateAi = useCallback(async (mood: MoodKey | null) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setAiState("loading");
    setAiError(null);
    const res = await api<{ items: CatalogueItem[]; ai: { generated: number; cached: number; error: string | null } }>("/api/recommendations", { method: "POST", body: { mood } });
    inFlight.current = false;
    setAiState("idle");
    if (!res.ok) {
      setAiError(res.error);
      return;
    }
    setItems(res.data.items);
    setAiError(res.data.ai.error);
    if (res.data.ai.generated) toast.success(`Gemini scored ${res.data.ai.generated} title${res.data.ai.generated === 1 ? "" : "s"}`);
  }, []);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshState("loading");
    const res = await api<{ message: string }>("/api/releases/refresh", { method: "POST" });
    inFlight.current = false;
    if (res.ok) {
      setRefreshState("success");
      toast.success(res.data.message);
      router.refresh();
    } else {
      setRefreshState(res.status === 429 ? "idle" : "error");
      toast[res.status === 429 ? "info" : "error"](res.data && "message" in (res.data as object) ? (res.data as { message: string }).message : res.error);
    }
    setTimeout(() => setRefreshState("idle"), 4000);
  }, [router]);

  // Titles the viewer could watch that still lack a verdict (others are skipped on purpose).
  const unscored = items.filter((i) => i.verified && !i.recommendation && scoringExclusion(i, prefs) === null).length;

  // Generate missing verdicts once per page visit; cached ones are reused server-side.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!opts.autoScore || autoRan.current || unscored === 0) return;
    autoRan.current = true;
    const t = setTimeout(() => generateAi(prefs.mood), 0);
    return () => clearTimeout(t);
  }, [opts.autoScore, unscored, generateAi, prefs.mood]);

  return { items, setItems, setWatchStatus, refresh, refreshState, generateAi, aiState, aiError, unscored };
}
