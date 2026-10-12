"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLATFORMS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import type { Digest } from "@/lib/types";
import { adminFetch } from "./admin";
import { TitleCard } from "./TitleCard";

type Filter = "all" | "watch" | (typeof PLATFORMS)[number];

export function DigestBoard({ digest, status }: { digest: Digest | null; status: Record<string, boolean> }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<"generate" | "send" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const items = useMemo(() => {
    const all = digest?.items ?? [];
    if (filter === "all") return all;
    if (filter === "watch") return all.filter((i) => i.verdict === "watch");
    return all.filter((i) => i.platforms.includes(filter));
  }, [digest, filter]);

  async function run(action: "generate" | "send") {
    setBusy(action);
    setMsg(null);
    const res = await adminFetch("/api/digest", "POST", { action, id: digest?.id });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setMsg(body.error ?? "Something went wrong");
    if (action === "send") setMsg(body.sent ? "Sent to Telegram ✓" : `Not sent: ${body.telegramError}`);
    startTransition(() => router.refresh());
  }

  const watchCount = digest?.items.filter((i) => i.verdict === "watch").length ?? 0;

  return (
    <>
      <section className="pb-10 pt-14 text-center sm:pt-20">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-gold">
          {digest ? `${formatDate(digest.windowStart)} — ${formatDate(digest.windowEnd)} · India` : "Your Friday digest"}
        </p>
        <h1 className="font-display text-5xl leading-[1.05] sm:text-7xl">
          New this week, <em className="text-gold-soft">worth</em> your Friday.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-muted">
          Fresh releases from Netflix, Prime Video and JioHotstar, filtered to your genres and languages. Gemini says watch or skip.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => run("generate")}
            disabled={!!busy}
            className="rounded-full bg-text px-6 py-2.5 text-sm font-medium text-ink transition hover:bg-gold-soft disabled:opacity-50"
          >
            {busy === "generate" ? "Scanning releases…" : digest ? "Refresh digest" : "Build this week’s digest"}
          </button>
          {digest && (
            <button
              onClick={() => run("send")}
              disabled={!!busy}
              className="rounded-full border border-line px-6 py-2.5 text-sm transition hover:border-gold/60 hover:text-gold-soft disabled:opacity-50"
            >
              {busy === "send" ? "Sending…" : digest.sent ? "Send again to Telegram" : "Send to Telegram"}
            </button>
          )}
        </div>
        {msg && <p className="mt-4 text-sm text-gold-soft">{msg}</p>}

        <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
          {Object.entries(status).map(([k, ok]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-watch" : "bg-line"}`} /> {k}
            </span>
          ))}
        </div>
      </section>

      {digest?.source === "sample" && (
        <p className="mb-6 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-center text-sm text-gold-soft">
          Showing fictional sample titles. Add <code>TMDB_API_KEY</code> to pull live releases.
        </p>
      )}

      {digest && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <div className="flex gap-6 text-sm">
              <Stat n={digest.items.length} label="new for you" />
              <Stat n={watchCount} label="worth watching" />
              <Stat n={digest.items.length - watchCount} label="skip" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "watch", ...PLATFORMS] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    filter === f ? "bg-gold text-ink" : "border border-line text-muted hover:text-text"
                  }`}
                >
                  {f === "all" ? "All" : f === "watch" ? "Watch only" : f}
                </button>
              ))}
            </div>
          </div>

          {items.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((i) => (
                <TitleCard key={`${i.kind}-${i.tmdbId}`} item={i} />
              ))}
            </div>
          ) : (
            <Empty text="Nothing new matched here this week." />
          )}
        </>
      )}

      {!digest && <Empty text="No digest yet. Build one to see what dropped this week." />}
    </>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <span>
      <span className="font-display text-3xl">{n}</span> <span className="text-muted">{label}</span>
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line py-20 text-center text-muted">
      <p className="font-display text-2xl italic text-text/70">Quiet week.</p>
      <p className="mt-2 text-sm">{text}</p>
    </div>
  );
}
