import { Suspense } from "react";
import { connection } from "next/server";
import { formatDate } from "@/lib/dates";
import { listDigests } from "@/lib/store";

export default function HistoryPage() {
  return (
    <section className="mx-auto max-w-3xl pt-14">
      <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">Archive</p>
      <h1 className="font-display text-5xl">Past digests</h1>
      <Suspense fallback={<p className="py-16 text-muted">Loading…</p>}>
        <List />
      </Suspense>
    </section>
  );
}

async function List() {
  await connection();
  const digests = await listDigests(30);
  if (!digests.length) return <p className="mt-10 text-muted">No digests yet.</p>;

  return (
    <ul className="mt-10 divide-y divide-line border-y border-line">
      {digests.map((d) => {
        const watch = d.items.filter((i) => i.verdict === "watch");
        return (
          <li key={d.id} className="flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl">
                {formatDate(d.windowStart)} – {formatDate(d.windowEnd)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {d.items.length} titles · {watch.length} watch
                {watch.length > 0 && ` · ${watch.slice(0, 3).map((i) => i.title).join(", ")}`}
                {d.source === "sample" && " · sample data"}
              </p>
            </div>
            <span
              className={`self-start rounded-full px-3 py-1 text-xs sm:self-auto ${
                d.sent ? "bg-watch/15 text-watch" : d.telegramError ? "bg-skip/15 text-skip" : "border border-line text-muted"
              }`}
              title={d.telegramError ?? undefined}
            >
              {d.sent ? `Sent ${new Date(d.sentAt!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}` : d.telegramError ? "Send failed" : "Not sent"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
