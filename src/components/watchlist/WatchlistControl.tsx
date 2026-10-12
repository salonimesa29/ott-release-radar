"use client";
import { useState } from "react";
import { Bookmark, BookmarkCheck, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WATCH_STATUSES, type WatchStatus } from "@/config/taxonomy";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

export async function saveWatchStatus(titleId: string, status: WatchStatus | null): Promise<boolean> {
  const res = status
    ? await api("/api/watchlist", { method: "POST", body: { titleId, status } })
    : await api("/api/watchlist", { method: "DELETE", body: { titleId } });
  if (!res.ok) toast.error(res.error);
  return res.ok;
}

/** Compact watchlist status selector. Persists to Supabase, then reports the change upward. */
export function WatchlistControl({
  titleId,
  status,
  onChange,
  variant = "icon",
}: {
  titleId: string;
  status: WatchStatus | null;
  onChange: (s: WatchStatus | null) => void;
  variant?: "icon" | "button";
}) {
  const [busy, setBusy] = useState(false);
  const label = WATCH_STATUSES.find((s) => s.key === status)?.label;

  async function set(next: WatchStatus | null) {
    setBusy(true);
    const ok = await saveWatchStatus(titleId, next);
    setBusy(false);
    if (ok) {
      onChange(next);
      toast.success(next ? `Marked “${WATCH_STATUSES.find((s) => s.key === next)!.label}”` : "Removed from watchlist");
    }
  }

  const icon = busy ? <Loader2 className="animate-spin" /> : status && status !== "not_interested" ? <BookmarkCheck className="text-cyan" /> : <Bookmark />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button variant="secondary" size="icon-sm" aria-label={label ? `Watchlist: ${label}` : "Add to watchlist"} className="bg-black/60 backdrop-blur hover:bg-black/80">
            {icon}
          </Button>
        ) : (
          <Button variant={status ? "secondary" : "outline"} size="lg" className="h-10 px-4">
            {icon}
            {label ?? "Add to Watchlist"}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Watchlist status</DropdownMenuLabel>
        {WATCH_STATUSES.map((s) => (
          <DropdownMenuItem key={s.key} onSelect={() => set(s.key)}>
            <Check className={cn(status === s.key ? "opacity-100" : "opacity-0")} />
            {s.label}
          </DropdownMenuItem>
        ))}
        {status && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => set(null)} className="text-skip">
              <Trash2 /> Remove
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
