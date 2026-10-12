import { describe, expect, it } from "vitest";
import { releaseWindow } from "@/lib/dates/ist";
import { claimDigest } from "@/lib/db/users";
import type { DigestRow } from "@/lib/db/mappers";
import { DIGEST_MAX, digestKey, selectDigestItems } from "@/lib/ranking/digest-select";
import { callsOf, fakeSupabase, makeItem, makePreferences } from "../fixtures";

const digestRow = (o: Partial<DigestRow> = {}): DigestRow => ({
  id: "digest-1",
  kind: "weekly",
  period_start: "2026-10-06",
  period_end: "2026-10-12",
  status: "sent",
  telegram_message_ids: ["101", 102],
  chunks_total: 2,
  chunks_sent: 2,
  title_count: 7,
  recommended_count: 4,
  message_preview: "preview",
  message_chunks: ["a", "b"],
  sent_at: "2026-10-12T12:31:00Z",
  error_message: null,
  idempotency_key: "weekly:user-1:2026-10-06",
  created_at: "2026-10-12T12:30:00Z",
  ...o,
});

const claim = { userId: "user-1", kind: "weekly" as const, periodStart: "2026-10-06", periodEnd: "2026-10-12", key: "weekly:user-1:2026-10-06", status: "pending" as const };

describe("digest idempotency", () => {
  it("digestKey is stable per user + period and distinct otherwise", () => {
    expect(digestKey("weekly", "user-1", "2026-10-06")).toBe("weekly:user-1:2026-10-06");
    expect(digestKey("weekly", "user-1", "2026-10-06")).toBe(digestKey("weekly", "user-1", "2026-10-06"));
    expect(digestKey("weekly", "user-2", "2026-10-06")).not.toBe(digestKey("weekly", "user-1", "2026-10-06"));
    expect(digestKey("weekly", "user-1", "2026-10-07")).not.toBe(digestKey("weekly", "user-1", "2026-10-06"));
    expect(digestKey("preview", "user-1", "2026-10-06")).not.toBe(digestKey("weekly", "user-1", "2026-10-06"));
  });

  it("two cron firings on the same IST day produce the same key", () => {
    const a = releaseWindow(new Date("2026-10-12T12:30:00Z"));
    const b = releaseWindow(new Date("2026-10-12T12:45:00Z"));
    expect(digestKey("weekly", "user-1", a.start)).toBe(digestKey("weekly", "user-1", b.start));
  });

  it("claimDigest creates a record on first claim", async () => {
    const { client, queries } = fakeSupabase([{ data: digestRow({ status: "pending" }) }]);
    const res = await claimDigest(client, claim);
    expect(res.created).toBe(true);
    expect(res.record.status).toBe("pending");
    expect(callsOf(queries[0], "insert")[0][0]).toMatchObject({ user_id: "user-1", idempotency_key: claim.key });
  });

  it("claimDigest returns the existing record on a unique-key conflict (23505)", async () => {
    const { client, queries } = fakeSupabase([
      { error: { message: "duplicate key value violates unique constraint", code: "23505" } },
      { data: digestRow() },
    ]);
    const res = await claimDigest(client, claim);
    expect(res.created).toBe(false);
    expect(res.record.id).toBe("digest-1");
    expect(res.record.status).toBe("sent");
    expect(res.record.telegramMessageIds).toEqual([101, 102]);
    expect(callsOf(queries[1], "eq")).toEqual([["idempotency_key", claim.key]]);
  });

  it("claimDigest throws on other database errors", async () => {
    const { client } = fakeSupabase([{ error: { message: "connection reset", code: "08006" } }]);
    await expect(claimDigest(client, claim)).rejects.toThrow("creating digest record");
  });

  it("claimDigest throws if the conflicting record cannot be found", async () => {
    const { client } = fakeSupabase([{ error: { message: "dup", code: "23505" } }, { data: null }]);
    await expect(claimDigest(client, claim)).rejects.toThrow("vanished");
  });
});

describe("digest selection", () => {
  const prefs = makePreferences({ genres: ["thriller"], languages: ["hi"], platforms: ["netflix"], contentTypes: ["movie", "tv"], discoveryMode: "balanced" });
  const good = (score = 80, o: Parameters<typeof makeItem>[0] = {}) =>
    makeItem({ title: { genreIds: [53], originalLanguage: "hi" }, release: { providerKey: "netflix" }, recommendation: { matchScore: score, verdict: score >= 60 ? "watch" : score >= 35 ? "maybe" : "skip" }, ...o });

  it("excludes unverified, not-interested, watched, wrong-platform, wrong-language and excluded titles", () => {
    const keep = good();
    const items = [
      keep,
      good(90, { release: { providerKey: "netflix", availabilityStatus: "unverified_date" } }),
      good(90, { watchStatus: "not_interested" }),
      good(90, { watchStatus: "watched" }),
      good(90, { release: { providerKey: "prime_video" } }),
      good(90, { title: { genreIds: [53], originalLanguage: "en" } }),
    ];
    const excluded = good(95);
    const out = selectDigestItems([...items, excluded], prefs, new Set([excluded.title.id]));
    expect(out).toEqual([keep]);
  });

  it("keeps want-to-watch and watching titles", () => {
    const a = good(80, { watchStatus: "want_to_watch" });
    const b = good(70, { watchStatus: "watching" });
    expect(selectDigestItems([a, b], prefs)).toEqual([a, b]);
  });

  it("respects content types", () => {
    const tv = good(80, { title: { mediaType: "tv", genreIds: [9648], originalLanguage: "hi" } });
    expect(selectDigestItems([tv], { ...prefs, contentTypes: ["movie"] })).toEqual([]);
    expect(selectDigestItems([tv], prefs)).toEqual([tv]);
  });

  it("discoveryMode 'stick' drops off-genre titles; 'surprise' keeps them; 'balanced' keeps strong ones", () => {
    const offGenreStrong = good(90, { title: { genreIds: [35], originalLanguage: "hi" } });
    const offGenreWeak = good(50, { title: { genreIds: [35], originalLanguage: "hi" } });
    const onGenre = good(60);
    const pick = (mode: "stick" | "balanced" | "surprise") => selectDigestItems([offGenreStrong, offGenreWeak, onGenre], { ...prefs, discoveryMode: mode });
    expect(pick("stick")).toEqual([onGenre]);
    expect(pick("balanced")).toEqual([offGenreStrong, onGenre]);
    expect(pick("surprise")).toEqual([offGenreStrong, onGenre, offGenreWeak]);
  });

  it(`caps the digest at ${DIGEST_MAX} titles, highest scores first`, () => {
    const items = Array.from({ length: 15 }, (_, i) => good(60 + i));
    const out = selectDigestItems(items, prefs);
    expect(out).toHaveLength(10);
    expect(out.map((i) => i.recommendation!.matchScore)).toEqual([74, 73, 72, 71, 70, 69, 68, 67, 66, 65]);
  });

  it("puts skip verdicts last even when they score higher", () => {
    const skip = good(54, { recommendation: { matchScore: 54, verdict: "skip" } });
    const maybe = good(40);
    expect(selectDigestItems([skip, maybe], prefs)).toEqual([maybe, skip]);
  });

  it("ranks unscored titles below scored ones using half the rule score", () => {
    const unscored = good(0, { recommendation: null }); // rule score 30+25+15=70 → 35
    const scored = good(40);
    expect(selectDigestItems([unscored, scored], prefs)).toEqual([scored, unscored]);
  });

  it("returns [] for no items", () => {
    expect(selectDigestItems([], prefs)).toEqual([]);
  });
});
