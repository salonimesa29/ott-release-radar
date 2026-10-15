"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { MoodKey, WatchStatus } from "@/config/taxonomy";
import { languageLabel } from "@/config/taxonomy";
import { scoringExclusion } from "@/lib/ranking/signals";
import { cn } from "@/lib/utils";
import type { CatalogueItem, Preferences } from "@/types/domain";
import { WatchlistControl } from "@/components/watchlist/WatchlistControl";
import { MatchScore } from "./MatchScore";
import { PlatformBadge, ReleaseDateLabel, VerdictBadge } from "./badges";
import { Poster } from "./Poster";

export function lengthText(item: CatalogueItem): string | null {
  const t = item.title;
  if (t.mediaType === "movie") return t.runtimeMinutes ? `${Math.floor(t.runtimeMinutes / 60)}h ${t.runtimeMinutes % 60}m` : null;
  const r = item.primaryRelease;
  const parts = [
    r.releaseDateType === "series_premiere" ? "New series" : r.seasonNumber ? `Season ${r.seasonNumber}` : null,
    r.episodeCount ? `${r.episodeCount} eps` : null,
    t.episodeRuntimeMinutes ? `~${t.episodeRuntimeMinutes}m/ep` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function ReleaseCard({
  item,
  prefs,
  mood,
  onWatchStatus,
  href,
  index = 0,
}: {
  item: CatalogueItem;
  prefs: Preferences;
  mood: MoodKey | null;
  onWatchStatus: (id: string, s: WatchStatus | null) => void;
  href: string;
  index?: number;
}) {
  const t = item.title;
  const rec = item.recommendation;
  const length = lengthText(item);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.03 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-violet/40"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-muted sm:aspect-[3/4]">
        <Poster
          path={t.posterPath}
          alt={`${t.title} poster`}
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
          fallbackLabel={t.title}
          className="transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 scrim-b opacity-90" />
        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {item.platforms.map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>
          <WatchlistControl titleId={t.id} status={item.watchStatus} onChange={(s) => onWatchStatus(t.id, s)} />
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur">
              {t.mediaType === "movie" ? "Movie" : "Series"}
            </span>
            {rec && <VerdictBadge verdict={rec.verdict} />}
          </div>
          <MatchScore item={item} prefs={prefs} mood={mood} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <Link href={href} className="group/title flex items-start gap-1 outline-none focus-visible:underline">
          <h3 className="font-display text-[1.45rem] leading-tight text-balance">{t.title}</h3>
          <ArrowUpRight className="mt-1 size-4 shrink-0 opacity-0 transition group-hover/title:opacity-60" />
        </Link>
        <ReleaseDateLabel release={item.primaryRelease} compact />
        <p className="text-xs text-muted-foreground">{[languageLabel(t.originalLanguage), length].filter(Boolean).join(" · ")}</p>
        {t.genreNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {t.genreNames.slice(0, 3).map((g) => (
              <span key={g} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                {g}
              </span>
            ))}
          </div>
        )}
        <p className={cn("mt-auto line-clamp-3 border-t border-border pt-2.5 text-[13px] leading-relaxed", rec ? "text-foreground/80" : "text-muted-foreground")}>
          {rec ? rec.explanation : scoringExclusion(item, prefs) ?? "AI verdict not generated yet."}
        </p>
      </div>
    </motion.article>
  );
}

export function ReleaseRow({
  item,
  prefs,
  mood,
  onWatchStatus,
  href,
}: {
  item: CatalogueItem;
  prefs: Preferences;
  mood: MoodKey | null;
  onWatchStatus: (id: string, s: WatchStatus | null) => void;
  href: string;
}) {
  const t = item.title;
  const rec = item.recommendation;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 transition-colors hover:border-violet/40">
      <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Poster path={t.posterPath} alt={`${t.title} poster`} size="w342" sizes="56px" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href} className="truncate font-display text-xl hover:underline">
            {t.title}
          </Link>
          {rec && <VerdictBadge verdict={rec.verdict} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{t.mediaType === "movie" ? "Movie" : "Series"}</span>
          <span>{languageLabel(t.originalLanguage)}</span>
          {lengthText(item) && <span>{lengthText(item)}</span>}
          <ReleaseDateLabel release={item.primaryRelease} compact />
          <span className="hidden sm:inline">{t.genreNames.slice(0, 3).join(" · ")}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {item.platforms.map((p) => (
            <PlatformBadge key={p} platform={p} />
          ))}
        </div>
      </div>
      <MatchScore item={item} prefs={prefs} mood={mood} size="sm" />
      <WatchlistControl titleId={t.id} status={item.watchStatus} onChange={(s) => onWatchStatus(t.id, s)} />
    </div>
  );
}
