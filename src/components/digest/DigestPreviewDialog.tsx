"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VerdictBadge } from "@/components/releases/badges";
import { api } from "@/lib/client-api";
import { formatWindow } from "@/lib/dates/ist";
import type { ReleaseWindow, Verdict } from "@/types/domain";
import { TelegramBubble } from "./TelegramMessage";

type Preview = {
  window: ReleaseWindow;
  messages: string[];
  aiError: string | null;
  eligibleCount: number;
  items: { id: string; title: string; platforms: string[]; verdict: Verdict | null; score: number | null; reason: string | null; matched: string[] }[];
};

/** "Preview My Friday Digest": builds the real digest; never sends anything. */
export function DigestPreviewDialog() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Preview | null>(null);

  async function load() {
    setState("loading");
    setError(null);
    const res = await api<Preview>("/api/digest/preview", { method: "POST" });
    if (res.ok) {
      setData(res.data);
      setState("idle");
    } else {
      setError(res.error);
      setState("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-11 bg-gradient-to-r from-violet to-[#6f5cf0] px-5 shadow-[0_8px_30px_-8px_rgb(139_108_255/0.6)]">
          <Send /> Preview My Friday Digest
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle className="font-display text-3xl font-normal">Your Friday digest</DialogTitle>
          <DialogDescription>
            Preview only — nothing is sent. {data && `${formatWindow(data.window)} · ${data.items.length} of ${data.eligibleCount} verified releases selected.`}
          </DialogDescription>
        </DialogHeader>
        {state === "loading" && (
          <div className="flex items-center justify-center gap-2 p-16 text-muted-foreground">
            <Loader2 className="animate-spin" /> Building your digest with Gemini…
          </div>
        )}
        {state === "error" && (
          <div className="p-10 text-center">
            <p className="text-skip">{error}</p>
            <Button variant="outline" className="mt-4" onClick={load}>Retry</Button>
          </div>
        )}
        {state === "idle" && data && (
          <div className="grid max-h-[70dvh] md:grid-cols-[1fr_1.1fr]">
            <ScrollArea className="max-h-[70dvh] border-b border-border md:border-b-0 md:border-r">
              <div className="space-y-3 p-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Included titles & why</p>
                {data.aiError && <p className="rounded-lg bg-maybe/10 p-3 text-xs text-maybe">{data.aiError}</p>}
                {data.items.length === 0 && <p className="text-sm text-muted-foreground">No verified releases match your preferences this week.</p>}
                {data.items.map((i, n) => (
                  <div key={i.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/title/${i.id}`} className="font-medium hover:underline">{n + 1}. {i.title}</Link>
                      {i.verdict && <VerdictBadge verdict={i.verdict} />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{i.platforms.join(", ")}{i.score !== null && ` · ${i.score}/100`}</p>
                    {i.reason && <p className="mt-2 text-sm text-foreground/80">{i.reason}</p>}
                    {i.matched.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {i.matched.map((m) => <span key={m} className="rounded bg-cyan/10 px-1.5 py-0.5 text-[11px] text-cyan">{m}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <ScrollArea className="max-h-[70dvh] bg-[#0e1621]">
              <div className="space-y-3 p-5">
                <p className="text-xs uppercase tracking-widest text-[#7f91a4]">Telegram preview · {data.messages.length} message{data.messages.length === 1 ? "" : "s"}</p>
                {data.messages.map((m, i) => <TelegramBubble key={i} html={m} />)}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
