"use client";
import { useState } from "react";
import { Eye, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDay, formatTimestamp } from "@/lib/dates/ist";
import { cn } from "@/lib/utils";
import type { DigestRecord } from "@/types/domain";
import { DigestPreviewDialog } from "./DigestPreviewDialog";
import { TelegramBubble } from "./TelegramMessage";

function statusLabel(d: DigestRecord): { text: string; tone: string } {
  if (d.kind === "preview") return { text: "Preview generated", tone: "bg-secondary text-muted-foreground" };
  if (d.status === "sent") return { text: d.kind === "test" ? "Test message sent" : "Weekly digest sent", tone: "bg-watch/15 text-watch" };
  if (d.status === "partial") return { text: `Partly delivered (${d.chunksSent}/${d.chunksTotal})`, tone: "bg-maybe/15 text-maybe" };
  if (d.status === "failed") return { text: "Delivery failed", tone: "bg-skip/15 text-skip" };
  if (d.status === "pending") return { text: "Sending…", tone: "bg-secondary text-muted-foreground" };
  return { text: d.status, tone: "bg-secondary text-muted-foreground" };
}

export function DigestHistoryView({ history, lastDelivery }: { history: DigestRecord[]; lastDelivery: string | null }) {
  const [open, setOpen] = useState<DigestRecord | null>(null);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan">Delivery log</p>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl">Digest History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last successful delivery: {lastDelivery ? `${formatTimestamp(lastDelivery)} IST` : "none yet"}</p>
        </div>
        <DigestPreviewDialog />
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-20 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-2xl">No digests yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Preview one now, or send a test from Settings once Telegram is connected.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Period</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Releases</th>
                <th className="p-3 font-medium">Recommended</th>
                <th className="p-3 font-medium">Sent</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((d) => {
                const s = statusLabel(d);
                return (
                  <tr key={d.id} className="align-top">
                    <td className="p-3">{formatDay(d.periodStart)} – {formatDay(d.periodEnd, true)}</td>
                    <td className="p-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs", s.tone)}>{s.text}</span>
                      {d.errorMessage && <p className="mt-1 max-w-xs text-xs text-skip">{d.errorMessage}</p>}
                    </td>
                    <td className="p-3 tabular-nums">{d.titleCount}</td>
                    <td className="p-3 tabular-nums">{d.recommendedCount}</td>
                    <td className="p-3 text-muted-foreground">{d.sentAt ? formatTimestamp(d.sentAt) : "—"}</td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" disabled={!d.messageChunks.length && !d.messagePreview} onClick={() => setOpen(d)}>
                        <Eye /> Message
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{open && statusLabel(open).text}</DialogTitle>
            <DialogDescription>{open && `${formatDay(open.periodStart)} – ${formatDay(open.periodEnd, true)}`}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65dvh] rounded-xl bg-[#0e1621]">
            <div className="space-y-3 p-4">
              {(open?.messageChunks.length ? open.messageChunks : open?.messagePreview ? [open.messagePreview] : []).map((m, i) => <TelegramBubble key={i} html={m} />)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
