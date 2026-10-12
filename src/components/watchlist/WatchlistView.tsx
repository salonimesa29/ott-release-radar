"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WATCH_STATUSES, type WatchStatus } from "@/config/taxonomy";
import { PROVIDER_LIST, type ProviderKey } from "@/config/providers";
import type { CatalogueItem, Preferences } from "@/types/domain";
import { ReleaseRow } from "@/components/releases/ReleaseCard";

export function WatchlistView({ initialItems, prefs }: { initialItems: CatalogueItem[]; prefs: Preferences }) {
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState<WatchStatus | "all">("all");
  const [platform, setPlatform] = useState<ProviderKey | "all">("all");
  const [media, setMedia] = useState<"all" | "movie" | "tv">("all");

  const onWatchStatus = (id: string, s: WatchStatus | null) =>
    setItems((prev) => (s ? prev.map((i) => (i.title.id === id ? { ...i, watchStatus: s } : i)) : prev.filter((i) => i.title.id !== id)));

  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (status === "all" ? i.watchStatus !== "not_interested" : i.watchStatus === status) &&
          (platform === "all" || i.platforms.includes(platform)) &&
          (media === "all" || i.title.mediaType === media),
      ),
    [items, status, platform, media],
  );
  const counts = Object.fromEntries(WATCH_STATUSES.map((s) => [s.key, items.filter((i) => i.watchStatus === s.key).length]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan">Saved</p>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl">My Watchlist</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" variant="outline" value={status} onValueChange={(v) => v && setStatus(v as WatchStatus | "all")} className="flex-wrap">
          <ToggleGroupItem value="all" className="px-3">All</ToggleGroupItem>
          {WATCH_STATUSES.map((s) => (
            <ToggleGroupItem key={s.key} value={s.key} className="px-3">{s.label} <span className="text-muted-foreground">{counts[s.key]}</span></ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={platform} onValueChange={(v) => setPlatform(v as ProviderKey | "all")}>
          <SelectTrigger className="h-9 w-40" aria-label="Platform"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PROVIDER_LIST.map((p) => <SelectItem key={p.key} value={p.key}>{p.shortLabel}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={media} onValueChange={(v) => setMedia(v as "all" | "movie" | "tv")}>
          <SelectTrigger className="h-9 w-36" aria-label="Media type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Movies & series</SelectItem>
            <SelectItem value="movie">Movies</SelectItem>
            <SelectItem value="tv">Series</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {shown.length ? (
        <div className="space-y-2">
          {shown.map((i) => <ReleaseRow key={i.title.id} item={i} prefs={prefs} mood={null} onWatchStatus={onWatchStatus} href={`/title/${i.title.id}?back=/watchlist`} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-20 text-center">
          <Bookmark className="size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-2xl">{items.length ? "Nothing in this view" : "Your watchlist is empty"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Use the bookmark on any release to save it here.</p>
          <Button asChild className="mt-5"><Link href="/discover">Discover releases</Link></Button>
        </div>
      )}
      {prefs.useFeedback && <p className="text-xs text-muted-foreground">Titles marked “Not interested” are excluded from your digest and Pick My Next Watch, and are passed to Gemini as feedback. You can turn this off in Preferences.</p>}
    </div>
  );
}
