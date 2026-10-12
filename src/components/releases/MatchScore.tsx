"use client";
import { Check, Minus, X, HelpCircle } from "lucide-react";
import type { MoodKey } from "@/config/taxonomy";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchSignals } from "@/lib/ranking/signals";
import { cn } from "@/lib/utils";
import type { CatalogueItem, Preferences } from "@/types/domain";

/** Score ring; clicking opens "Why this matches you", built from real signals only. */
export function MatchScore({ item, prefs, mood, size = "md" }: { item: CatalogueItem; prefs: Preferences; mood: MoodKey | null; size?: "sm" | "md" | "lg" }) {
  const rec = item.recommendation;
  const dim = size === "lg" ? 56 : size === "sm" ? 36 : 44;
  const r = 15;
  const c = 2 * Math.PI * r;
  const value = rec?.matchScore ?? null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid shrink-0 place-items-center rounded-full outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
          style={{ width: dim, height: dim }}
          aria-label={value === null ? "Match not scored yet — see signals" : `${value} out of 100 match — why?`}
        >
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
            <circle cx="18" cy="18" r={r} fill="rgb(7 7 10 / .7)" stroke="rgb(255 255 255 / .1)" strokeWidth="2.5" />
            {value !== null && (
              <circle cx="18" cy="18" r={r} fill="none" stroke="url(#score-g)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
            )}
            <defs>
              <linearGradient id="score-g">
                <stop offset="0" stopColor="#8b6cff" />
                <stop offset="1" stopColor="#4fd8eb" />
              </linearGradient>
            </defs>
          </svg>
          <span className={cn("relative font-semibold tabular-nums", size === "lg" ? "text-base" : "text-xs")}>{value ?? "–"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <WhyThisMatches item={item} prefs={prefs} mood={mood} />
      </PopoverContent>
    </Popover>
  );
}

export function WhyThisMatches({ item, prefs, mood }: { item: CatalogueItem; prefs: Preferences; mood: MoodKey | null }) {
  const s = matchSignals(item, prefs, mood);
  const rec = item.recommendation;
  const rows: { label: string; value: string; tone: "good" | "mid" | "bad" | "unknown" }[] = [
    {
      label: "Genre alignment",
      value: s.genre.level === "unknown" ? "No genre data" : s.genre.level === "none" ? "Outside your genres" : `${s.genre.level === "strong" ? "Strong" : "Partial"} · ${s.genre.matched.join(", ")}`,
      tone: s.genre.level === "strong" ? "good" : s.genre.level === "partial" ? "mid" : s.genre.level === "none" ? "bad" : "unknown",
    },
    {
      label: "Language",
      value: s.language.level === "exact" ? `Exact match · ${s.language.label}` : `${s.language.label} isn't in your languages`,
      tone: s.language.level === "exact" ? "good" : "bad",
    },
    {
      label: "Platform availability",
      value: s.platform.labels.length ? `${s.platform.level === "verified" ? "Verified" : "Listed, date unverified"} · ${s.platform.labels.join(", ")}` : "Not on your platforms",
      tone: !s.platform.labels.length ? "bad" : s.platform.level === "verified" ? "good" : "mid",
    },
    {
      label: "Viewing mood",
      value: s.mood.level === "not_set" ? "No mood selected" : s.mood.level === "unknown" ? "Can't tell (no genre data)" : s.mood.level === "compatible" ? `Compatible · ${s.mood.label}` : `Neutral for ${s.mood.label}`,
      tone: s.mood.level === "compatible" ? "good" : s.mood.level === "neutral" ? "mid" : "unknown",
    },
    {
      label: "Personalisation confidence",
      value: `${cap(rec?.confidence ?? s.confidence)}${rec ? "" : " (metadata only)"}`,
      tone: (rec?.confidence ?? s.confidence) === "high" ? "good" : (rec?.confidence ?? s.confidence) === "medium" ? "mid" : "bad",
    },
  ];

  return (
    <div className="text-sm">
      <p className="font-display text-xl">Why this matches you</p>
      {rec ? (
        <p className="mt-1 text-muted-foreground">
          Gemini: <span className="text-foreground">{rec.matchScore}/100</span>, {rec.verdict}. {rec.explanation}
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">No AI score yet. The signals below come straight from the metadata.</p>
      )}
      <ul className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex gap-2.5">
            <ToneIcon tone={r.tone} />
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{r.label}</p>
              <p className="text-[13px]">{r.value}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-muted-foreground">Match score measures fit with your preferences, not the title’s quality.</p>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ToneIcon({ tone }: { tone: "good" | "mid" | "bad" | "unknown" }) {
  const cls = "mt-0.5 size-4 shrink-0";
  if (tone === "good") return <Check className={cn(cls, "text-watch")} />;
  if (tone === "mid") return <Minus className={cn(cls, "text-maybe")} />;
  if (tone === "bad") return <X className={cn(cls, "text-skip")} />;
  return <HelpCircle className={cn(cls, "text-muted-foreground")} />;
}
