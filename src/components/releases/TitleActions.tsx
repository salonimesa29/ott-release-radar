"use client";
import { useState } from "react";
import type { CatalogueItem, Preferences } from "@/types/domain";
import { WatchlistControl } from "@/components/watchlist/WatchlistControl";
import { MatchScore } from "./MatchScore";
import { ReleaseDateLabel } from "./badges";

export function TitleActions({ item, prefs }: { item: CatalogueItem; prefs: Preferences }) {
  const [status, setStatus] = useState(item.watchStatus);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <MatchScore item={item} prefs={prefs} mood={null} size="lg" />
      <ReleaseDateLabel release={item.primaryRelease} />
      <WatchlistControl variant="button" titleId={item.title.id} status={status} onChange={setStatus} />
    </div>
  );
}
