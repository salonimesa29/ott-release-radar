import Image from "next/image";
import { languageLabel } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import type { DigestItem } from "@/lib/types";

const PLATFORM_STYLE: Record<string, string> = {
  Netflix: "text-[#e5484d] border-[#e5484d]/30",
  "Prime Video": "text-[#4fb3ff] border-[#4fb3ff]/30",
  JioHotstar: "text-[#7d8cff] border-[#7d8cff]/30",
};

function length(i: DigestItem) {
  if (i.kind === "movie") return i.runtimeMinutes ? `${Math.floor(i.runtimeMinutes / 60)}h ${i.runtimeMinutes % 60}m` : "Film";
  const eps = i.episodeCount ? `${i.episodeCount} eps` : "Series";
  return `${i.seasonLabel ?? "Series"} · ${eps}`;
}

export function TitleCard({ item }: { item: DigestItem }) {
  const watch = item.verdict === "watch";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-gold/40">
      <div className="relative aspect-[16/10] overflow-hidden bg-raised">
        {item.posterPath ? (
          <Image
            src={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover object-top opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,#2a2419,#0d0d0d_70%)]">
            <span className="font-display text-3xl italic text-gold/50">{item.title.split(" ")[0]}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/20 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {item.platforms.map((p) => (
            <span key={p} className={`rounded-full border bg-ink/80 px-2.5 py-0.5 text-[11px] font-medium backdrop-blur ${PLATFORM_STYLE[p]}`}>
              {p}
            </span>
          ))}
        </div>
        <div
          className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
            watch ? "bg-watch text-ink" : "border border-skip/50 bg-ink/80 text-skip"
          }`}
        >
          {watch ? "Watch" : "Skip"}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 pt-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl leading-tight">{item.title}</h3>
          <Score value={item.score} />
        </div>
        <p className="text-xs text-muted">
          {languageLabel(item.language)} · {length(item)} · {formatDate(item.releaseDate)}
          {item.rating ? ` · ★ ${item.rating.toFixed(1)}` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {item.genres.slice(0, 4).map((g) => (
            <span key={g} className="rounded-md bg-raised px-2 py-0.5 text-[11px] text-muted">
              {g}
            </span>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-text/80">{item.synopsis}</p>
        <p className={`mt-auto border-t border-line pt-3 text-sm italic ${watch ? "text-gold-soft" : "text-muted"}`}>
          &ldquo;{item.reason}&rdquo;
        </p>
      </div>
    </article>
  );
}

function Score({ value }: { value: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-10 w-10 shrink-0 place-items-center" title={`${value}% match`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-line)" strokeWidth="2.5" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="text-[11px] font-semibold">{value}</span>
    </div>
  );
}
