import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WatchStatus } from "@/config/taxonomy";
import type { DigestRecord, Preferences, Recommendation, WatchlistEntry } from "@/types/domain";
import {
  fromPreferences,
  toDigest,
  toPreferences,
  toRecommendation,
  type DigestRow,
  type PrefsRow,
  type RecRow,
} from "./mappers";

function fail(error: { message: string } | null, what: string) {
  if (error) throw new Error(`Database error while ${what}: ${error.message}`);
}

const PREF_COLS =
  "user_id,preferred_genres,preferred_languages,preferred_platforms,preferred_content_types,preferred_runtime,dubbed_content_preference,popularity_preference,genre_exploration,discovery_mode,preferred_mood,use_feedback,digest_enabled,digest_day,digest_time,timezone,telegram_chat_id,telegram_username,telegram_connected";

/* ---------- Preferences ---------- */

export async function getPreferences(db: SupabaseClient, userId: string): Promise<Preferences> {
  const { data, error } = await db.from("user_preferences").select(PREF_COLS).eq("user_id", userId).maybeSingle();
  fail(error, "loading preferences");
  if (!data) throw new Error("Preferences row missing for this account");
  return toPreferences(data as PrefsRow);
}

/** Uses the caller's client; with a user client, RLS + column grants limit writes to safe columns. */
export async function updatePreferences(db: SupabaseClient, userId: string, patch: Partial<Preferences>) {
  const { data, error } = await db
    .from("user_preferences")
    .update(fromPreferences(patch))
    .eq("user_id", userId)
    .select(PREF_COLS)
    .single();
  fail(error, "saving preferences");
  return toPreferences(data as PrefsRow);
}

/** Server-only (admin client): set or clear a verified Telegram chat. */
export async function setTelegramChat(
  admin: SupabaseClient,
  userId: string,
  chat: { id: number; username: string | null } | null,
) {
  const { error } = await admin
    .from("user_preferences")
    .update({
      telegram_chat_id: chat?.id ?? null,
      telegram_username: chat?.username ?? null,
      telegram_connected: !!chat,
    })
    .eq("user_id", userId);
  fail(error, "saving Telegram connection");
}

/** Admin: every user who should get a digest today. */
export async function listDigestRecipients(admin: SupabaseClient, weekday: number) {
  const { data, error } = await admin
    .from("user_preferences")
    .select(PREF_COLS)
    .eq("digest_enabled", true)
    .eq("telegram_connected", true)
    .eq("digest_day", weekday)
    .not("telegram_chat_id", "is", null);
  fail(error, "listing digest recipients");
  return (data ?? []).map((r) => ({ userId: r.user_id as string, prefs: toPreferences(r as PrefsRow) }));
}

/* ---------- Watchlist & feedback ---------- */

export async function listWatchlist(db: SupabaseClient, userId: string): Promise<WatchlistEntry[]> {
  const { data, error } = await db
    .from("watchlist")
    .select("title_id,status,added_at,updated_at")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  fail(error, "loading watchlist");
  return (data ?? []).map((r) => ({ titleId: r.title_id, status: r.status, addedAt: r.added_at, updatedAt: r.updated_at }));
}

export async function upsertWatchlist(db: SupabaseClient, userId: string, titleId: string, status: WatchStatus) {
  const { error } = await db
    .from("watchlist")
    .upsert({ user_id: userId, title_id: titleId, status }, { onConflict: "user_id,title_id" });
  fail(error, "saving watchlist");
}

export async function removeWatchlist(db: SupabaseClient, userId: string, titleId: string) {
  const { error } = await db.from("watchlist").delete().eq("user_id", userId).eq("title_id", titleId);
  fail(error, "removing from watchlist");
}

export async function addFeedback(db: SupabaseClient, userId: string, titleId: string, type: "not_interested" | "liked" | "disliked") {
  const { error } = await db.from("viewing_feedback").insert({ user_id: userId, title_id: titleId, feedback_type: type });
  fail(error, "saving feedback");
}

export async function clearFeedback(db: SupabaseClient, userId: string, titleId: string, type: "not_interested") {
  const { error } = await db.from("viewing_feedback").delete().eq("user_id", userId).eq("title_id", titleId).eq("feedback_type", type);
  fail(error, "clearing feedback");
}

export async function listNotInterested(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await db
    .from("viewing_feedback")
    .select("title_id")
    .eq("user_id", userId)
    .eq("feedback_type", "not_interested");
  fail(error, "loading feedback");
  return [...new Set((data ?? []).map((r) => r.title_id as string))];
}

/* ---------- Recommendations ---------- */

export async function getRecommendations(db: SupabaseClient, userId: string, prefFingerprint: string, titleIds: string[]) {
  if (!titleIds.length) return new Map<string, Recommendation & { metadataFingerprint: string }>();
  const { data, error } = await db
    .from("ai_recommendations")
    .select("title_id,match_score,verdict,synopsis,explanation,matched_preferences,confidence,model_name,generated_at,metadata_fingerprint,preference_fingerprint")
    .eq("user_id", userId)
    .eq("preference_fingerprint", prefFingerprint)
    .in("title_id", titleIds);
  fail(error, "loading recommendations");
  return new Map(
    ((data ?? []) as RecRow[]).map((r) => [r.title_id, { ...toRecommendation(r), metadataFingerprint: r.metadata_fingerprint }]),
  );
}

/** Admin: recommendations are generated server-side only. */
export async function saveRecommendations(
  admin: SupabaseClient,
  userId: string,
  recs: (Recommendation & { metadataFingerprint: string; preferenceFingerprint: string })[],
) {
  if (!recs.length) return;
  const { error } = await admin.from("ai_recommendations").upsert(
    recs.map((r) => ({
      user_id: userId,
      title_id: r.titleId,
      match_score: r.matchScore,
      verdict: r.verdict,
      synopsis: r.synopsis,
      explanation: r.explanation,
      matched_preferences: r.matchedPreferences,
      confidence: r.confidence,
      model_name: r.modelName,
      generated_at: r.generatedAt,
      metadata_fingerprint: r.metadataFingerprint,
      preference_fingerprint: r.preferenceFingerprint,
    })),
    { onConflict: "user_id,title_id,preference_fingerprint" },
  );
  fail(error, "saving recommendations");
}

/* ---------- Digest history ---------- */

const DIGEST_COLS =
  "id,kind,period_start,period_end,status,telegram_message_ids,chunks_total,chunks_sent,title_count,recommended_count,message_preview,message_chunks,sent_at,error_message,idempotency_key,created_at";

export async function listDigestHistory(db: SupabaseClient, userId: string, limit = 50): Promise<DigestRecord[]> {
  const { data, error } = await db
    .from("digest_history")
    .select(DIGEST_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error, "loading digest history");
  return ((data ?? []) as DigestRow[]).map(toDigest);
}

export async function getDigestByKey(admin: SupabaseClient, key: string): Promise<DigestRecord | null> {
  const { data, error } = await admin.from("digest_history").select(DIGEST_COLS).eq("idempotency_key", key).maybeSingle();
  fail(error, "loading digest");
  return data ? toDigest(data as DigestRow) : null;
}

/**
 * Claim a digest slot by idempotency key. Returns the existing row if one exists.
 * The unique constraint on idempotency_key makes concurrent claims safe.
 */
export async function claimDigest(
  admin: SupabaseClient,
  row: { userId: string; kind: DigestRecord["kind"]; periodStart: string; periodEnd: string; key: string; status: DigestRecord["status"] },
): Promise<{ record: DigestRecord; created: boolean }> {
  const { data, error } = await admin
    .from("digest_history")
    .insert({
      user_id: row.userId,
      kind: row.kind,
      period_start: row.periodStart,
      period_end: row.periodEnd,
      status: row.status,
      idempotency_key: row.key,
    })
    .select(DIGEST_COLS)
    .single();
  if (!error) return { record: toDigest(data as DigestRow), created: true };
  if (error.code !== "23505") fail(error, "creating digest record");
  const existing = await getDigestByKey(admin, row.key);
  if (!existing) throw new Error("Digest record vanished during claim");
  return { record: existing, created: false };
}

export async function updateDigest(admin: SupabaseClient, id: string, patch: Partial<DigestRecord>) {
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.telegramMessageIds) {
    row.telegram_message_ids = patch.telegramMessageIds;
    row.telegram_message_id = patch.telegramMessageIds[0] ?? null;
  }
  if (patch.chunksTotal !== undefined) row.chunks_total = patch.chunksTotal;
  if (patch.chunksSent !== undefined) row.chunks_sent = patch.chunksSent;
  if (patch.titleCount !== undefined) row.title_count = patch.titleCount;
  if (patch.recommendedCount !== undefined) row.recommended_count = patch.recommendedCount;
  if (patch.messagePreview !== undefined) row.message_preview = patch.messagePreview;
  if (patch.messageChunks !== undefined) row.message_chunks = patch.messageChunks;
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt;
  if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage;
  const { error } = await admin.from("digest_history").update(row).eq("id", id);
  fail(error, "updating digest record");
}

export async function lastSuccessfulDelivery(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db
    .from("digest_history")
    .select("sent_at")
    .eq("user_id", userId)
    .in("kind", ["weekly", "test"])
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(error, "loading last delivery");
  return (data?.sent_at as string | undefined) ?? null;
}

export async function getProfile(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from("profiles").select("display_name,created_at").eq("id", userId).maybeSingle();
  fail(error, "loading profile");
  return { displayName: (data?.display_name as string | null) ?? null, createdAt: (data?.created_at as string | null) ?? null };
}

export async function updateProfile(db: SupabaseClient, userId: string, displayName: string) {
  const { error } = await db.from("profiles").update({ display_name: displayName }).eq("id", userId);
  fail(error, "saving profile");
}
