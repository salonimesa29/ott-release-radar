import { describe, expect, it, vi } from "vitest";

// telegram.service imports the Supabase server client (cookies, env); stub it so no I/O happens.
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: vi.fn(), createUserClient: vi.fn() }));

import { classifyTelegramError, TELEGRAM_ERROR_HELP } from "@/lib/telegram/client";
import { buildDigestMessages, escapeHtml, formatEntry, safeLink, TELEGRAM_LIMIT } from "@/lib/telegram/format";
import { findChatForCode } from "@/services/telegram.service";
import type { ReleaseWindow } from "@/types/domain";
import { makeItem } from "../fixtures";

const W: ReleaseWindow = { start: "2026-10-06", end: "2026-10-12" };

describe("Telegram error handling", () => {
  it("classifies API errors", () => {
    expect(classifyTelegramError(429, "Too Many Requests: retry after 5")).toBe("rate_limited");
    expect(classifyTelegramError(403, "Forbidden: bot was blocked by the user")).toBe("blocked");
    expect(classifyTelegramError(400, "Bad Request: chat not found")).toBe("invalid_chat");
    expect(classifyTelegramError(400, "Bad Request: CHAT_ID IS EMPTY")).toBe("invalid_chat");
    expect(classifyTelegramError(400, "Bad Request: message is too long")).toBe("api");
    expect(classifyTelegramError(500, "Internal Server Error")).toBe("api");
  });

  it("has user-facing help for every error kind", () => {
    for (const kind of ["invalid_chat", "blocked", "rate_limited", "network", "api"] as const) {
      expect(TELEGRAM_ERROR_HELP[kind].length).toBeGreaterThan(10);
    }
  });
});

describe("Telegram digest formatting", () => {
  const long = (n: number, word: string) => Array.from({ length: n }, () => word).join(" ");

  it("splits long digests so every message is within the limit and no title is lost", () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeItem({
        title: {
          title: `Fixture Title ${String(i + 1).padStart(2, "0")}`,
          genreNames: ["Thriller", "Crime", "Drama", "Mystery"],
        },
        recommendation: { explanation: long(40, "match").slice(0, 240), synopsis: long(60, "story").slice(0, 400), matchScore: 80, verdict: "watch" },
      }),
    );
    const messages = buildDigestMessages(items, W);
    expect(messages.length).toBeGreaterThan(1);
    for (const m of messages) expect(m.length).toBeLessThanOrEqual(TELEGRAM_LIMIT);

    const all = messages.join("\n");
    for (let i = 1; i <= 30; i++) {
      const heading = `<b>${i}. FIXTURE TITLE ${String(i).padStart(2, "0")}</b>`;
      expect(all.split(heading)).toHaveLength(2); // appears exactly once
      // ...and is never split across two messages.
      expect(messages.filter((m) => m.includes(heading))).toHaveLength(1);
    }
    expect(messages[0]).toContain("30 verified new releases for you");
  });

  it("escapes HTML in titles and text", () => {
    const item = makeItem({ title: { title: "<script>&", overview: 'He said "<b>hi</b>"' } });
    const msg = buildDigestMessages([item], W)[0];
    expect(msg).toContain("&lt;SCRIPT&gt;&amp;");
    expect(msg).not.toContain("<SCRIPT>");
    expect(msg).not.toContain("<script>");
    expect(msg).toContain("&quot;&lt;b&gt;hi&lt;/b&gt;&quot;");
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  it("returns a single friendly message for an empty list", () => {
    const messages = buildDigestMessages([], W);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("No verified new releases matched your preferences this week");
    expect(messages[0].length).toBeLessThanOrEqual(TELEGRAM_LIMIT);
  });

  it("marks test digests", () => {
    expect(buildDigestMessages([], W, { test: true })[0]).toContain("<i>test</i>");
  });

  it("safeLink only allows https themoviedb.org URLs", () => {
    expect(safeLink("https://www.themoviedb.org/movie/1/watch?locale=IN")).toBe("https://www.themoviedb.org/movie/1/watch?locale=IN");
    expect(safeLink("https://themoviedb.org/tv/2")).toBe("https://themoviedb.org/tv/2");
    expect(safeLink("http://www.themoviedb.org/movie/1")).toBeNull();
    expect(safeLink("https://themoviedb.org.evil.example/x")).toBeNull();
    expect(safeLink("https://evilthemoviedb.org/x")).toBeNull();
    expect(safeLink("https://evil.example/https://www.themoviedb.org")).toBeNull();
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("not a url")).toBeNull();
    expect(safeLink(null)).toBeNull();
  });

  it("formatEntry omits untrusted links", () => {
    expect(formatEntry(makeItem({ release: { sourceUrl: "https://evil.example/" } }), 1)).not.toContain("<a href");
    expect(formatEntry(makeItem(), 1)).toContain('<a href="https://www.themoviedb.org/');
  });

  it("formatEntry says the AI verdict is unavailable when there is no recommendation", () => {
    const entry = formatEntry(makeItem({ recommendation: null }), 3);
    expect(entry).toContain("AI verdict unavailable.");
    expect(entry).not.toContain("Match:");
  });
});

describe("Telegram connection code matching", () => {
  const upd = (id: number, text: string, type = "private", chatId = 555) => ({
    update_id: id,
    message: { text, chat: { id: chatId, type, username: `user${chatId}` } },
  });

  it("finds the private chat that sent /start <code>", () => {
    expect(findChatForCode([upd(1, "hello"), upd(2, "/start ABC123")], "ABC123")).toEqual({ id: 555, username: "user555" });
    expect(findChatForCode([upd(1, "  ABC123  ")], "ABC123")).toEqual({ id: 555, username: "user555" });
  });

  it("ignores group chats and other codes", () => {
    expect(findChatForCode([upd(1, "/start ABC123", "group", 777)], "ABC123")).toBeNull();
    expect(findChatForCode([upd(1, "/start OTHER")], "ABC123")).toBeNull();
    expect(findChatForCode([{ update_id: 1 }], "ABC123")).toBeNull();
    expect(findChatForCode([], "ABC123")).toBeNull();
  });

  it("uses the most recent matching update", () => {
    expect(findChatForCode([upd(1, "/start ABC123", "private", 1), upd(2, "/start ABC123", "private", 2)], "ABC123")?.id).toBe(2);
  });
});
