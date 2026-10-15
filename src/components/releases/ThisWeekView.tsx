"use client";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, RotateCcw, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PROVIDER_KEYS, type ProviderKey } from "@/config/providers";
import { GENRE_KEYS, type GenreKey } from "@/config/taxonomy";
import { useCatalogue } from "@/hooks/useCatalogue";
import { applyFilters, type DiscoveryFilters, type SortKey } from "@/lib/ranking/filters";
import { formatWindow } from "@/lib/dates/ist";
import type { CatalogueItem, Preferences, ReleaseWindow, Verdict } from "@/types/domain";
import { GENRE_OPTIONS, LANGUAGE_OPTIONS, MultiSelect, PlatformToggles } from "@/components/filters/controls";
import { ReleaseCard, ReleaseRow } from "./ReleaseCard";
import { SyncBar } from "./SyncBar";

const PAGE = 24;
const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : null);

/** Filters live in the URL so they survive navigating to a title and back. */
export function ThisWeekView({ initialItems, prefs, window, lastSyncedAt, lastRefreshFailed }: { initialItems: CatalogueItem[]; prefs: Preferences; window: ReleaseWindow; lastSyncedAt: string | null; lastRefreshFailed: boolean }) {
  const cat = useCatalogue(initialItems, prefs, { autoScore: true });
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: DiscoveryFilters = {
    platforms: (list(sp.get("p")) ?? prefs.platforms).filter((p): p is ProviderKey => (PROVIDER_KEYS as readonly string[]).includes(p)),
    genres: (list(sp.get("g")) ?? []).filter((g): g is GenreKey => (GENRE_KEYS as readonly string[]).includes(g)),
    languages: list(sp.get("l")) ?? [],
    quick: sp.get("type") === "movie" ? "movies" : sp.get("type") === "tv" ? "series" : "all",
    watchTime: "any",
    mood: null,
    hiddenGems: false,
    verifiedOnly: sp.get("unverified") !== "1",
    verdict: (["watch", "maybe", "skip"].includes(sp.get("v") ?? "") ? sp.get("v") : "any") as Verdict | "any",
    search: sp.get("q") ?? "",
    sort: (["newest", "match", "title", "runtime"].includes(sp.get("sort") ?? "") ? sp.get("sort") : "newest") as SortKey,
  };
  const view = sp.get("view") === "list" ? "list" : "grid";
  const shown = Number(sp.get("n")) || PAGE;

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("n" in patch)) next.delete("n");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const { items } = useMemo(() => applyFilters(cat.items, filters), [cat.items, sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const href = (id: string) => `/title/${id}?back=${encodeURIComponent(`${pathname}?${sp.toString()}`)}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan">New this week</p>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl">{formatWindow(window)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seven days to today, India time. The window is never widened to pad results.</p>
      </div>
      <SyncBar lastSyncedAt={lastSyncedAt} lastRefreshFailed={lastRefreshFailed} refreshState={cat.refreshState} onRefresh={cat.refresh} unscored={cat.unscored} aiState={cat.aiState} aiError={cat.aiError} onGenerate={() => cat.generateAi(null)} />

      <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input defaultValue={filters.search} placeholder="Search by title" aria-label="Search by title" className="h-9 pl-9" onChange={(e) => update({ q: e.target.value })} />
          </div>
          <PlatformToggles value={filters.platforms} onChange={(v) => update({ p: v.join(",") })} />
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <MultiSelect label="Genres" options={GENRE_OPTIONS} value={filters.genres} onChange={(v) => update({ g: v.join(",") })} placeholder="Search genres…" />
          <MultiSelect label="Languages" options={LANGUAGE_OPTIONS} value={filters.languages} onChange={(v) => update({ l: v.join(",") })} placeholder="Search languages…" />
          <Select value={sp.get("type") ?? "all"} onValueChange={(v) => update({ type: v === "all" ? null : v })}>
            <SelectTrigger className="h-9 w-36" aria-label="Movie or series"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Movies & series</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
              <SelectItem value="tv">Series</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.verdict} onValueChange={(v) => update({ v: v === "any" ? null : v })}>
            <SelectTrigger className="h-9 w-40" aria-label="Recommendation"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any verdict</SelectItem>
              <SelectItem value="watch">Watch</SelectItem>
              <SelectItem value="maybe">Maybe</SelectItem>
              <SelectItem value="skip">Skip</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => update({ sort: v })}>
            <SelectTrigger className="h-9 w-48" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest verified release</SelectItem>
              <SelectItem value="match">Highest AI match</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
              <SelectItem value="runtime">Shortest runtime</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={!filters.verifiedOnly} onCheckedChange={(on) => update({ unverified: on ? "1" : null })} />
            Include unverified dates
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.replace(pathname, { scroll: false })}><RotateCcw /> Reset</Button>
            <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && update({ view: v === "grid" ? null : v })} aria-label="Layout">
              <ToggleGroupItem value="grid" aria-label="Grid"><LayoutGrid /></ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="Compact list"><List /></ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{items.length} title{items.length === 1 ? "" : "s"}</p>
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-20 text-center">
          <SearchX className="size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-2xl">{cat.items.length ? "No titles match these filters" : "No releases synced for this window yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{cat.items.length ? "Try removing a filter or including unverified dates." : "Use Refresh Releases above to pull live data."}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.slice(0, shown).map((i, n) => <ReleaseCard key={i.title.id} index={n % PAGE} item={i} prefs={prefs} mood={null} onWatchStatus={cat.setWatchStatus} href={href(i.title.id)} />)}
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, shown).map((i) => <ReleaseRow key={i.title.id} item={i} prefs={prefs} mood={null} onWatchStatus={cat.setWatchStatus} href={href(i.title.id)} />)}
        </div>
      )}
      {items.length > shown && (
        <div className="text-center">
          <Button variant="outline" onClick={() => update({ n: String(shown + PAGE) })}>Load more ({items.length - shown} remaining)</Button>
        </div>
      )}
    </div>
  );
}
