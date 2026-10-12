import { describe, expect, it } from "vitest";
import { listWatchlist, removeWatchlist, upsertWatchlist } from "@/lib/db/users";
import { watchlistDeleteSchema, watchlistUpsertSchema } from "@/lib/validation/schemas";
import { callsOf, fakeSupabase, fakeUuid } from "../fixtures";

const USER = fakeUuid();
const TITLE = fakeUuid();

describe("watchlist operations", () => {
  it("upsertWatchlist scopes the row to the user and upserts on (user_id, title_id)", async () => {
    const { client, queries } = fakeSupabase([{ error: null }]);
    await upsertWatchlist(client, USER, TITLE, "watched");
    expect(queries).toHaveLength(1);
    expect(queries[0].table).toBe("watchlist");
    expect(callsOf(queries[0], "upsert")).toEqual([[{ user_id: USER, title_id: TITLE, status: "watched" }, { onConflict: "user_id,title_id" }]]);
  });

  it("removeWatchlist deletes only this user's row for this title", async () => {
    const { client, queries } = fakeSupabase([{ error: null }]);
    await removeWatchlist(client, USER, TITLE);
    expect(queries[0].table).toBe("watchlist");
    expect(callsOf(queries[0], "delete")).toHaveLength(1);
    expect(callsOf(queries[0], "eq")).toEqual([
      ["user_id", USER],
      ["title_id", TITLE],
    ]);
  });

  it("listWatchlist filters by user, orders newest first and maps rows", async () => {
    const rows = [
      { title_id: TITLE, status: "want_to_watch", added_at: "2026-10-11T10:00:00Z", updated_at: "2026-10-11T10:00:00Z" },
      { title_id: "t-2", status: "not_interested", added_at: "2026-10-10T10:00:00Z", updated_at: "2026-10-10T11:00:00Z" },
    ];
    const { client, queries } = fakeSupabase([{ data: rows }]);
    const out = await listWatchlist(client, USER);
    expect(callsOf(queries[0], "eq")).toEqual([["user_id", USER]]);
    expect(callsOf(queries[0], "order")).toEqual([["added_at", { ascending: false }]]);
    expect(out).toEqual([
      { titleId: TITLE, status: "want_to_watch", addedAt: "2026-10-11T10:00:00Z", updatedAt: "2026-10-11T10:00:00Z" },
      { titleId: "t-2", status: "not_interested", addedAt: "2026-10-10T10:00:00Z", updatedAt: "2026-10-10T11:00:00Z" },
    ]);
  });

  it("listWatchlist returns [] when there are no rows", async () => {
    const { client } = fakeSupabase([{ data: null }]);
    expect(await listWatchlist(client, USER)).toEqual([]);
  });

  it("surfaces database errors", async () => {
    const { client } = fakeSupabase([{ error: { message: "permission denied for table watchlist" } }]);
    await expect(upsertWatchlist(client, USER, TITLE, "watching")).rejects.toThrow("Database error while saving watchlist: permission denied");
    const second = fakeSupabase([{ error: { message: "boom" } }]);
    await expect(removeWatchlist(second.client, USER, TITLE)).rejects.toThrow("removing from watchlist");
  });

  it("watchlistUpsertSchema accepts a valid status and UUID", () => {
    expect(watchlistUpsertSchema.safeParse({ titleId: TITLE, status: "watching" }).success).toBe(true);
  });

  it("watchlistUpsertSchema rejects a bad status or a non-UUID title id", () => {
    expect(watchlistUpsertSchema.safeParse({ titleId: TITLE, status: "favourite" }).success).toBe(false);
    expect(watchlistUpsertSchema.safeParse({ titleId: "123", status: "watched" }).success).toBe(false);
    expect(watchlistUpsertSchema.safeParse({ titleId: "' OR 1=1 --", status: "watched" }).success).toBe(false);
    expect(watchlistUpsertSchema.safeParse({ status: "watched" }).success).toBe(false);
    expect(watchlistDeleteSchema.safeParse({ titleId: "nope" }).success).toBe(false);
  });
});
