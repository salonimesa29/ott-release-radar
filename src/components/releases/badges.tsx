import { BadgeCheck, CircleHelp } from "lucide-react";
import { PROVIDERS, type ProviderKey } from "@/config/providers";
import { formatDay } from "@/lib/dates/ist";
import { DATE_TYPE_LABEL } from "@/lib/release/eligibility";
import { cn } from "@/lib/utils";
import type { OttRelease, Verdict } from "@/types/domain";

export function PlatformBadge({ platform, className }: { platform: ProviderKey; className?: string }) {
  const p = PROVIDERS[platform];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur", className)}>
      <span className="size-1.5 rounded-full" style={{ background: p.color }} aria-hidden />
      {p.shortLabel}
    </span>
  );
}

const VERDICT_STYLE: Record<Verdict, string> = {
  watch: "bg-watch/15 text-watch border-watch/30",
  maybe: "bg-maybe/15 text-maybe border-maybe/30",
  skip: "bg-skip/10 text-skip border-skip/25",
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", VERDICT_STYLE[verdict], className)}>
      {verdict}
    </span>
  );
}

/** Release date with its type. Unverified dates are labelled, never presented as OTT launches. */
export function ReleaseDateLabel({ release, compact = false }: { release: OttRelease; compact?: boolean }) {
  const verified = release.availabilityStatus === "verified";
  const date = release.streamingReleaseDate ? formatDay(release.streamingReleaseDate) : "Date not available";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", verified ? "text-foreground/80" : "text-maybe")} title={DATE_TYPE_LABEL[release.releaseDateType]}>
      {verified ? <BadgeCheck className="size-3.5 text-cyan" aria-label="Verified" /> : <CircleHelp className="size-3.5" aria-label="Unverified" />}
      {date}
      {!compact && <span className="text-muted-foreground">· {verified ? DATE_TYPE_LABEL[release.releaseDateType] : "OTT date unverified"}</span>}
    </span>
  );
}
