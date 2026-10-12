"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { MoodKey, WatchStatus } from "@/config/taxonomy";
import { api } from "@/lib/client-api";
import type { CatalogueItem } from "@/types/domain";

type RefreshState = "idle" | "loading" | "success" | "error";

/** Client state for the release catalogue: watchlist edits, refresh, and AI generation. */
export function useCatalogue(initial: CatalogueItem[]) {
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

  return { items, setItems, setWatchStatus, refresh, refreshState, generateAi, aiState, aiError };
}
