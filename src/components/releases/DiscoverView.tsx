"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROVIDERS, type ProviderKey } from "@/config/providers";
import { GENRES, languageLabel, type GenreKey, type MoodKey } from "@/config/taxonomy";
import { useCatalogue } from "@/hooks/useCatalogue";
import { applyFilters, discoveryStats, type DiscoveryFilters } from "@/lib/ranking/filters";
import type { CatalogueItem, Preferences } from "@/types/domain";
import { DigestPreviewDialog } from "@/components/digest/DigestPreviewDialog";
import {
  GENRE_OPTIONS,
  HiddenGemToggle,
  LANGUAGE_OPTIONS,
  MoodSelect,
  MultiSelect,
  PlatformToggles,
  QuickFilterControl,
  WatchTimeSelect,
} from "@/components/filters/controls";
import { Hero } from "./Hero";
import { PickNextWatch } from "./PickNextWatch";
import { ReleaseCard } from "./ReleaseCard";
import { SyncBar } from "./SyncBar";

export function defaultFilters(prefs: Preferences): DiscoveryFilters {
  return {
    platforms: prefs.platforms,
    genres: prefs.genres,
    languages: prefs.languages,
    quick: "all",
    watchTime: "any",
    mood: prefs.mood,
    hiddenGems: false,
    verifiedOnly: true,
    verdict: "any",
    search: "",
    sort: "newest",
  };
}

export function DiscoverView({
  initialItems,
  prefs,
  watchlistCount,
  lastSyncedAt,
  lastRefreshFailed,
}: {
  initialItems: CatalogueItem[];
  prefs: Preferences;
  watchlistCount: number;
  lastSyncedAt: string | null;
  lastRefreshFailed: boolean;
}) {
  const cat = useCatalogue(initialItems, prefs, { autoScore: true });
  const [filters, setFilters] = useState<DiscoveryFilters>(() => defaultFilters(prefs));
  const [draftGenres, setDraftGenres] = useState<GenreKey[]>(prefs.genres);
  const [draftLangs, setDraftLangs] = useState<string[]>(prefs.languages);
  const set = (patch: Partial<DiscoveryFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const { items, unknownDuration } = useMemo(() => applyFilters(cat.items, filters), [cat.items, filters]);
  const stats = useMemo(
    () => discoveryStats(cat.items, prefs, watchlistCount + cat.items.filter((i) => i.watchStatus && i.watchStatus !== "not_interested").length - initialItems.filter((i) => i.watchStatus && i.watchStatus !== "not_interested").length),
    [cat.items, prefs, watchlistCount, initialItems],
  );
  const featured = useMemo(() => applyFilters(cat.items, { ...defaultFilters(prefs), quick: "best" }).items[0] ?? null, [cat.items, prefs]);
  const unscored = cat.unscored;
  const isDirty = JSON.stringify(filters) !== JSON.stringify(defaultFilters(prefs));

  const reset = () => {
    setFilters(defaultFilters(prefs));
    setDraftGenres(prefs.genres);
    setDraftLangs(prefs.languages);
  };

  const syncBar = (
    <SyncBar
      lastSyncedAt={lastSyncedAt}
      lastRefreshFailed={lastRefreshFailed}
      refreshState={cat.refreshState}
      onRefresh={cat.refresh}
      unscored={unscored}
      aiState={cat.aiState}
      aiError={cat.aiError}
      onGenerate={() => cat.generateAi(filters.mood)}
    />
  );

  if (!cat.items.length) {
    return (
      <div className="space-y-6">
        {syncBar}
        <div className="rounded-3xl border border-dashed border-border px-6 py-24 text-center">
          <p className="font-display text-4xl">{lastSyncedAt ? "A quiet week." : "Let’s load this week’s releases."}</p>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            {lastSyncedAt
              ? "TMDB has no verified new releases on your platforms in this seven-day window yet."
              : "No release data has been synced yet. Run the first sync to pull live data from TMDB — it takes about a minute."}
          </p>
          <Button className="mt-6" size="lg" onClick={cat.refresh} disabled={cat.refreshState === "loading"}>
            {cat.refreshState === "loading" ? "Syncing with TMDB…" : "Refresh Releases"}
          </Button>
        </div>
      </div>
    );
  }

  const applyFooter = (kind: "genres" | "languages") => (
    <div className="flex gap-2">
      <Button size="xs" className="flex-1" onClick={() => set(kind === "genres" ? { genres: draftGenres } : { languages: draftLangs })}>Apply filters</Button>
      <Button size="xs" variant="ghost" onClick={() => (kind === "genres" ? (setDraftGenres(prefs.genres), set({ genres: prefs.genres })) : (setDraftLangs(prefs.languages), set({ languages: prefs.languages })))}>
        Reset to saved
      </Button>
    </div>
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan">Discover</p>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl">What’s new for you</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <PickNextWatch items={items} prefs={prefs} mood={filters.mood} onWatchStatus={cat.setWatchStatus} />
          <DigestPreviewDialog />
        </div>
      </div>
      {syncBar}

      {featured ? (
        <Hero item={featured} prefs={prefs} mood={filters.mood} onWatchStatus={cat.setWatchStatus} />
      ) : (
        <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">No verified release matches your saved preferences to feature this week.</p>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-5">
          <Stat label="Verified new releases" value={stats.eligible} hint={stats.unverified ? `+${stats.unverified} unverified` : undefined} />
          <Stat label="Match your genres" value={stats.genreMatches} />
          <Stat label="In your languages" value={stats.languageMatches} />
          <Stat label="Strong AI matches" value={stats.strongMatches} hint={stats.scored ? "score ≥ 75" : "not scored yet"} />
          <Stat label="On your watchlist" value={stats.watchlist} />
        </dl>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Your taste profile</p>
          <p className="mt-2 font-display text-xl leading-snug">{prefs.genres.map((g) => GENRES[g].label).join(" · ") || "Any genre"}</p>
          <p className="text-sm text-muted-foreground">{prefs.languages.map(languageLabel).join(" · ")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{prefs.platforms.map((p: ProviderKey) => PROVIDERS[p].shortLabel).join(" · ")}</p>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href="/preferences">Edit Preferences</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-3xl">This week</h2>
          <QuickFilterControl value={filters.quick} onChange={(quick) => set({ quick })} />
        </div>
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PlatformToggles value={filters.platforms} onChange={(platforms) => set({ platforms })} />
            <HiddenGemToggle value={filters.hiddenGems} onChange={(hiddenGems) => set({ hiddenGems })} />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Genres</p>
              <MultiSelect label="Genres" options={GENRE_OPTIONS} value={draftGenres} onChange={setDraftGenres} placeholder="Search genres…" footer={applyFooter("genres")} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Languages</p>
              <MultiSelect label="Languages" options={LANGUAGE_OPTIONS} value={draftLangs} onChange={setDraftLangs} placeholder="Search languages…" footer={applyFooter("languages")} />
            </div>
            <WatchTimeSelect value={filters.watchTime} onChange={(watchTime) => set({ watchTime })} />
            <MoodSelect value={filters.mood} onChange={(mood) => set({ mood })} />
            <Button variant="ghost" onClick={reset} disabled={!isDirty} className="ml-auto">
              <RotateCcw /> Reset Filters
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            These filters are temporary and don’t change your saved preferences. Mood re-ranks AI scores only when you click “Get AI verdicts”.
            {filters.watchTime !== "any" && unknownDuration > 0 && ` ${unknownDuration} title${unknownDuration === 1 ? "" : "s"} hidden because the duration isn't available.`}
          </p>
        </div>

        {filters.watchTime === "surprise" ? (
          <div className="rounded-2xl border border-border p-8 text-center">
            <p className="text-muted-foreground">Let us choose from {items.length} matching titles.</p>
            <div className="mt-4 flex justify-center">
              <PickNextWatch items={items} prefs={prefs} mood={filters.mood} onWatchStatus={cat.setWatchStatus} label="Surprise me" />
            </div>
          </div>
        ) : items.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {items.slice(0, 20).map((i, n) => (
              <ReleaseCard key={i.title.id} index={n} item={i} prefs={prefs} mood={filters.mood} onWatchStatus={cat.setWatchStatus} pending={cat.aiState === "loading"} href={`/title/${i.title.id}`} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-16 text-center">
            <SearchX className="size-8 text-muted-foreground" />
            <p className="mt-3 font-display text-2xl">Nothing matches these filters</p>
            <Button variant="outline" className="mt-4" onClick={reset}>Reset Filters</Button>
          </div>
        )}
        {items.length > 20 && filters.watchTime !== "surprise" && (
          <div className="text-center">
            <Button asChild variant="outline"><Link href="/this-week">See all {items.length} in This Week</Link></Button>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | MoodKey; hint?: string }) {
  return (
    <div className="bg-card p-4">
      <dd className="font-display text-4xl tabular-nums">{value}</dd>
      <dt className="mt-1 text-xs text-muted-foreground">{label}</dt>
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
