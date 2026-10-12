import { describe, expect, it } from "vitest";
import { fromPreferences, toPreferences, type PrefsRow } from "@/lib/db/mappers";
import { preferencesUpdateSchema } from "@/lib/validation/schemas";
import { makePreferences } from "../fixtures";

const EDITABLE_COLUMNS = [
  "preferred_genres",
  "preferred_languages",
  "preferred_platforms",
  "preferred_content_types",
  "preferred_runtime",
  "dubbed_content_preference",
  "popularity_preference",
  "genre_exploration",
  "discovery_mode",
  "preferred_mood",
  "use_feedback",
  "digest_enabled",
  "digest_day",
];

describe("preference persistence: validation", () => {
  it("accepts a valid partial patch and de-duplicates arrays", () => {
    const res = preferencesUpdateSchema.safeParse({ genres: ["thriller", "thriller", "comedy"], languages: ["hi", "ta"], digestDay: 5, mood: null });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ genres: ["thriller", "comedy"], languages: ["hi", "ta"], digestDay: 5, mood: null });
  });

  it("accepts an empty patch and an empty genre list", () => {
    expect(preferencesUpdateSchema.safeParse({}).success).toBe(true);
    expect(preferencesUpdateSchema.safeParse({ genres: [] }).success).toBe(true);
  });

  it.each([
    ["unknown genre", { genres: ["western"] }],
    ["unknown platform", { platforms: ["hulu"] }],
    ["empty languages", { languages: [] }],
    ["unsupported language", { languages: ["xx"] }],
    ["malformed language", { languages: ["Hindi"] }],
    ["empty platforms", { platforms: [] }],
    ["empty content types", { contentTypes: [] }],
    ["bad digest day", { digestDay: 7 }],
    ["fractional digest day", { digestDay: 2.5 }],
    ["unknown mood", { mood: "sleepy" }],
  ])("rejects %s", (_label, patch) => {
    expect(preferencesUpdateSchema.safeParse(patch).success).toBe(false);
  });

  it("rejects extra keys, including server-controlled Telegram fields", () => {
    expect(preferencesUpdateSchema.safeParse({ foo: 1 }).success).toBe(false);
    expect(preferencesUpdateSchema.safeParse({ genres: ["comedy"], telegramChatId: 123 }).success).toBe(false);
    expect(preferencesUpdateSchema.safeParse({ telegramConnected: true }).success).toBe(false);
    expect(preferencesUpdateSchema.safeParse({ timezone: "UTC" }).success).toBe(false);
  });
});

describe("preference persistence: mappers", () => {
  it("fromPreferences writes only editable snake_case columns (never telegram_*)", () => {
    const row = fromPreferences(makePreferences({ telegramChatId: 123456, telegramUsername: "someone", telegramConnected: true, mood: "feel_good" }));
    expect(Object.keys(row).sort()).toEqual([...EDITABLE_COLUMNS].sort());
    expect(Object.keys(row).some((k) => k.startsWith("telegram_"))).toBe(false);
    expect(row).not.toHaveProperty("digest_time");
    expect(row).not.toHaveProperty("timezone");
  });

  it("fromPreferences maps only the fields present in a patch, keeping explicit null / false", () => {
    expect(fromPreferences({})).toEqual({});
    expect(fromPreferences({ mood: null, useFeedback: false, digestDay: 0 })).toEqual({ preferred_mood: null, use_feedback: false, digest_day: 0 });
    expect(fromPreferences({ genres: ["comedy"] })).toEqual({ preferred_genres: ["comedy"] });
  });

  it("round-trips through a database row", () => {
    const prefs = makePreferences({
      genres: ["crime", "mystery"],
      languages: ["ta"],
      platforms: ["hotstar"],
      contentTypes: ["tv"],
      discoveryMode: "surprise",
      mood: "edge_of_seat",
      digestDay: 0,
      telegramChatId: 987654321,
      telegramUsername: "fixture_user",
      telegramConnected: true,
    });
    const row = {
      ...fromPreferences(prefs),
      digest_time: "18:00:00", // Postgres time column
      timezone: "Asia/Kolkata",
      telegram_chat_id: "987654321", // bigint arrives as a string
      telegram_username: "fixture_user",
      telegram_connected: true,
    } as PrefsRow;
    expect(toPreferences(row)).toEqual(prefs);
  });

  it("toPreferences keeps a null chat id as null", () => {
    const row = { ...fromPreferences(makePreferences()), digest_time: "18:00", timezone: "Asia/Kolkata", telegram_chat_id: null, telegram_username: null, telegram_connected: false } as PrefsRow;
    expect(toPreferences(row).telegramChatId).toBeNull();
  });
});
