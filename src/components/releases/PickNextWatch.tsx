"use client";
import { useState } from "react";
import Link from "next/link";
import { Dices, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MoodKey, WatchStatus } from "@/config/taxonomy";
import { weightedPick } from "@/lib/ranking/filters";
import type { CatalogueItem, Preferences } from "@/types/domain";
import { WatchlistControl } from "@/components/watchlist/WatchlistControl";
import { MatchScore } from "./MatchScore";
import { PlatformBadge, VerdictBadge } from "./badges";
import { Poster } from "./Poster";

/** Weighted random pick from the currently filtered, real results. */
export function PickNextWatch({ items, prefs, mood, onWatchStatus, label = "Pick My Next Watch" }: { items: CatalogueItem[]; prefs: Preferences; mood: MoodKey | null; onWatchStatus: (id: string, s: WatchStatus | null) => void; label?: string }) {
  const [pickId, setPickId] = useState<string | null>(null);
  const pick = items.find((i) => i.title.id === pickId) ?? null;

  const roll = () => setPickId(weightedPick(items, prefs)?.title.id ?? null);

  return (
    <>
      <Button variant="outline" size="lg" className="h-11 border-cyan/30 px-5 text-cyan hover:bg-cyan/10 hover:text-cyan" disabled={!items.length} onClick={roll}>
        <Dices /> {label}
      </Button>
      <Dialog open={!!pick} onOpenChange={(o) => !o && setPickId(null)}>
        <DialogContent className="sm:max-w-2xl">
          {pick && (
            <>
              <DialogHeader>
                <DialogDescription className="text-xs uppercase tracking-[0.25em] text-cyan">Tonight’s pick</DialogDescription>
                <DialogTitle className="font-display text-4xl font-normal">{pick.title.title}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
                <div className="relative mx-auto aspect-[2/3] w-40 overflow-hidden rounded-xl bg-muted">
                  <Poster path={pick.title.posterPath} alt={`${pick.title.title} poster`} sizes="160px" />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">{pick.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}</div>
                  <p className="text-sm leading-relaxed text-foreground/80">{pick.recommendation?.synopsis ?? pick.title.overview ?? "No synopsis available."}</p>
                  <div className="flex items-center gap-3">
                    <MatchScore item={pick} prefs={prefs} mood={mood} />
                    {pick.recommendation && <VerdictBadge verdict={pick.recommendation.verdict} />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="text-foreground">Why this pick: </span>
                    {pick.recommendation
                      ? `${pick.recommendation.explanation} Picked at random, weighted towards your strongest matches.`
                      : "Picked at random from your filtered results, weighted by how well its genres and language fit your profile (no AI score yet)."}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild><Link href={`/title/${pick.title.id}`}><Info /> View Details</Link></Button>
                    <WatchlistControl variant="button" titleId={pick.title.id} status={pick.watchStatus} onChange={(s) => onWatchStatus(pick.title.id, s)} />
                    <Button variant="ghost" onClick={roll}><Dices /> Pick again</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
