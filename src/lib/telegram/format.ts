import { PROVIDERS } from "@/config/providers";
import { languageLabel } from "@/config/taxonomy";
import { formatWindow } from "@/lib/dates/ist";
import type { CatalogueItem, ReleaseWindow } from "@/types/domain";

export const TELEGRAM_LIMIT = 4096;
const SAFE_LIMIT = 3800;
const DIVIDER = "────────────────";

/** Escape text for Telegram HTML parse mode. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Only http(s) URLs from a trusted host are linked. */
export function safeLink(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)themoviedb\.org$/.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

export function lengthLine(item: CatalogueItem): string | null {
  const t = item.title;
  if (t.mediaType === "movie") return t.runtimeMinutes ? `Runtime: ${t.runtimeMinutes} minutes` : null;
  const parts: string[] = [];
  const season = item.primaryRelease.seasonNumber;
  if (season) parts.push(item.primaryRelease.releaseDateType === "series_premiere" ? "New series" : `Season ${season}`);
  const eps = item.primaryRelease.episodeCount;
  if (eps) parts.push(`${eps} episode${eps === 1 ? "" : "s"}`);
  if (t.episodeRuntimeMinutes) parts.push(`~${t.episodeRuntimeMinutes} min per episode`);
  return parts.length ? parts.join(" · ") : null;
}

export function formatEntry(item: CatalogueItem, n: number): string {
  const rec = item.recommendation;
  const lines = [
    `<b>${n}. ${escapeHtml(item.title.title.toUpperCase())}</b>`,
    `Platform: ${escapeHtml(item.platforms.map((p) => PROVIDERS[p].shortLabel).join(", "))}`,
    item.title.genreNames.length ? `Genre: ${escapeHtml(item.title.genreNames.slice(0, 3).join(" · "))}` : null,
    `Language: ${escapeHtml(languageLabel(item.title.originalLanguage))}`,
    lengthLine(item) ? escapeHtml(lengthLine(item)!) : null,
  ];
  if (rec) {
    lines.push(
      "",
      "<b>WHY IT MATCHES YOU</b>",
      escapeHtml(rec.explanation),
      "",
      `<b>AI VERDICT: ${rec.verdict.toUpperCase()}</b>`,
      `Match: ${rec.matchScore}/100`,
      "",
      `<i>${escapeHtml(rec.synopsis)}</i>`,
    );
  } else if (item.title.overview) {
    lines.push("", `<i>${escapeHtml(item.title.overview.slice(0, 220))}${item.title.overview.length > 220 ? "…" : ""}</i>`, "AI verdict unavailable.");
  }
  const link = safeLink(item.primaryRelease.sourceUrl);
  if (link) lines.push("", `Where to watch: <a href="${escapeHtml(link)}">TMDB listing</a>`);
  return lines.filter((l) => l !== null).join("\n");
}

export function formatHeader(w: ReleaseWindow, count: number, test: boolean): string {
  return [
    `🎬 <b>OTT RELEASE RADAR</b>${test ? " · <i>test</i>" : ""}`,
    "Your personalised weekly watchlist",
    "",
    `📅 ${escapeHtml(formatWindow(w))}`,
    count ? `${count} verified new release${count === 1 ? "" : "s"} for you` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build digest messages, splitting on entry boundaries so no title is cut in half and no
 * message exceeds Telegram's 4096-character limit.
 */
export function buildDigestMessages(items: CatalogueItem[], w: ReleaseWindow, opts: { test?: boolean } = {}): string[] {
  const header = formatHeader(w, items.length, !!opts.test);
  if (!items.length) {
    return [`${header}\n\nNo verified new releases matched your preferences this week. Your watchlist is waiting 🍿`];
  }
  const messages: string[] = [];
  let current = header;
  items.forEach((item, i) => {
    let block = formatEntry(item, i + 1);
    if (block.length > SAFE_LIMIT) block = block.slice(0, SAFE_LIMIT - 1) + "…";
    const next = `${current}\n\n${DIVIDER}\n\n${block}`;
    if (next.length > SAFE_LIMIT) {
      messages.push(current);
      current = block;
    } else {
      current = next;
    }
  });
  messages.push(current);
  return messages;
}
