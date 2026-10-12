import "server-only";
import { formatDate } from "./dates";
import type { Digest, DigestItem } from "./types";
import { languageLabel } from "./constants";

const LIMIT = 4000;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function length(item: DigestItem) {
  if (item.kind === "movie") return item.runtimeMinutes ? `${item.runtimeMinutes} min` : "Movie";
  const eps = item.episodeCount ? `${item.episodeCount} episodes` : "Series";
  return item.seasonLabel && item.seasonLabel !== "New series" ? `${item.seasonLabel} · ${eps}` : eps;
}

export function formatItem(item: DigestItem, n: number) {
  const badge = item.verdict === "watch" ? "✅ <b>WATCH</b>" : "⏭ <b>SKIP</b>";
  const link = `https://www.themoviedb.org/${item.kind}/${item.tmdbId}`;
  return [
    `<b>${n}. <a href="${link}">${esc(item.title)}</a></b>`,
    `📺 ${esc(item.platforms.join(", "))} · ${languageLabel(item.language)} · ${esc(length(item))}`,
    `🏷 ${esc(item.genres.join(", "))}`,
    esc(item.synopsis),
    `${badge} (${item.score}% match) — <i>${esc(item.reason)}</i>`,
  ].join("\n");
}

export function formatDigest(d: Digest): string[] {
  const watch = d.items.filter((i) => i.verdict === "watch").length;
  const header =
    `🎬 <b>New This Week on OTT</b>\n${formatDate(d.windowStart)} – ${formatDate(d.windowEnd)} · India\n` +
    `${d.items.length} new for you · ${watch} worth watching` +
    (d.source === "sample" ? "\n<i>(sample data)</i>" : "");
  if (d.items.length === 0) return [`${header}\n\nNothing new matched your taste this week. Enjoy the backlog 🍿`];

  const chunks: string[] = [];
  let current = header;
  d.items.forEach((item, i) => {
    const block = formatItem(item, i + 1);
    if ((current + "\n\n" + block).length > LIMIT) {
      chunks.push(current);
      current = block;
    } else current += "\n\n" + block;
  });
  chunks.push(current);
  return chunks;
}

export async function sendTelegram(chatId: string, messages: string[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  for (const text of messages) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    const body = (await res.json()) as { ok: boolean; description?: string };
    if (!body.ok) throw new Error(`Telegram: ${body.description ?? res.status}`);
  }
}
