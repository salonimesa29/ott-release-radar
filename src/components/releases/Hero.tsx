"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { languageLabel, type MoodKey, type WatchStatus } from "@/config/taxonomy";
import { scoringExclusion } from "@/lib/ranking/signals";
import type { CatalogueItem, Preferences } from "@/types/domain";
import { WatchlistControl } from "@/components/watchlist/WatchlistControl";
import { MatchScore } from "./MatchScore";
import { PlatformBadge, ReleaseDateLabel, VerdictBadge } from "./badges";
import { Poster } from "./Poster";
import { lengthText } from "./ReleaseCard";

/** Featured release drawn from the real dataset (never fabricated). */
export function Hero({ item, prefs, mood, onWatchStatus }: { item: CatalogueItem; prefs: Preferences; mood: MoodKey | null; onWatchStatus: (id: string, s: WatchStatus | null) => void }) {
  const t = item.title;
  const rec = item.recommendation;
  const synopsis = rec?.synopsis ?? t.overview;
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative isolate overflow-hidden rounded-3xl border border-border bg-card"
    >
      <div className="absolute inset-0 -z-10">
        <Poster path={t.backdropPath ?? t.posterPath} alt="" size="w1280" sizes="100vw" priority className="opacity-60" />
        <div className="absolute inset-0 scrim-l" />
        <div className="absolute inset-0 scrim-b opacity-80" />
      </div>
      <div className="flex min-h-[420px] flex-col justify-end gap-5 p-6 sm:p-10 lg:min-h-[480px] lg:max-w-[60%]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan">Featured this week</span>
          {item.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
        </div>
        <h1 className="font-display text-5xl leading-[0.95] text-balance sm:text-7xl">{t.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/80">
          <ReleaseDateLabel release={item.primaryRelease} />
          <span>{languageLabel(t.originalLanguage)}</span>
          {t.genreNames.length > 0 && <span>{t.genreNames.slice(0, 3).join(" · ")}</span>}
          {lengthText(item) && <span>{lengthText(item)}</span>}
        </div>
        {synopsis && <p className="max-w-xl text-[15px] leading-relaxed text-foreground/75 line-clamp-3">{synopsis}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <MatchScore item={item} prefs={prefs} mood={mood} size="lg" />
          {rec ? (
            <div className="max-w-sm">
              <VerdictBadge verdict={rec.verdict} />
              <p className="mt-1 text-sm text-foreground/70">{rec.explanation}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{scoringExclusion(item, prefs) ?? "AI verdict not generated yet."}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-10 px-4">
            <Link href={`/title/${t.id}`}><Info /> View Details</Link>
          </Button>
          <WatchlistControl variant="button" titleId={t.id} status={item.watchStatus} onChange={(s) => onWatchStatus(t.id, s)} />
        </div>
      </div>
    </motion.section>
  );
}
