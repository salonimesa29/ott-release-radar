import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PREFERENCES } from "./constants";
import type { Digest, Preferences } from "./types";

let client: SupabaseClient | null = null;

export function hasSupabase() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function db() {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

// In-memory fallback for local development without Supabase.
const mem = globalThis as unknown as { __radar?: { prefs: Preferences; digests: Digest[] } };
mem.__radar ??= { prefs: DEFAULT_PREFERENCES, digests: [] };
const memory = mem.__radar;

type PrefRow = {
  genres: string[];
  languages: string[];
  platforms: Preferences["platforms"];
  window_days: number;
  telegram_chat_id: string | null;
};
type DigestRow = {
  id: string;
  created_at: string;
  window_start: string;
  window_end: string;
  source: Digest["source"];
  items: Digest["items"];
  sent: boolean;
  sent_at: string | null;
  telegram_error: string | null;
};

const toDigest = (r: DigestRow): Digest => ({
  id: r.id,
  createdAt: r.created_at,
  windowStart: r.window_start,
  windowEnd: r.window_end,
  source: r.source,
  items: r.items,
  sent: r.sent,
  sentAt: r.sent_at,
  telegramError: r.telegram_error,
});

export async function getPreferences(): Promise<Preferences> {
  if (!hasSupabase()) return memory.prefs;
  const { data, error } = await db().from("preferences").select("*").eq("id", "default").maybeSingle<PrefRow>();
  if (error) throw error;
  if (!data) return DEFAULT_PREFERENCES;
  return {
    genres: data.genres,
    languages: data.languages,
    platforms: data.platforms,
    windowDays: data.window_days,
    telegramChatId: data.telegram_chat_id,
  };
}

export async function savePreferences(p: Preferences): Promise<void> {
  if (!hasSupabase()) {
    memory.prefs = p;
    return;
  }
  const { error } = await db().from("preferences").upsert({
    id: "default",
    genres: p.genres,
    languages: p.languages,
    platforms: p.platforms,
    window_days: p.windowDays,
    telegram_chat_id: p.telegramChatId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function insertDigest(d: Omit<Digest, "id" | "createdAt">): Promise<Digest> {
  if (!hasSupabase()) {
    const digest = { ...d, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    memory.digests.unshift(digest);
    return digest;
  }
  const { data, error } = await db()
    .from("digests")
    .insert({
      window_start: d.windowStart,
      window_end: d.windowEnd,
      source: d.source,
      items: d.items,
      sent: d.sent,
      sent_at: d.sentAt,
      telegram_error: d.telegramError,
    })
    .select()
    .single<DigestRow>();
  if (error) throw error;
  return toDigest(data);
}

export async function markSent(id: string, error: string | null): Promise<void> {
  const patch = { sent: !error, sentAt: error ? null : new Date().toISOString(), telegramError: error };
  if (!hasSupabase()) {
    const d = memory.digests.find((x) => x.id === id);
    if (d) Object.assign(d, patch);
    return;
  }
  const res = await db()
    .from("digests")
    .update({ sent: patch.sent, sent_at: patch.sentAt, telegram_error: patch.telegramError })
    .eq("id", id);
  if (res.error) throw res.error;
}

export async function getDigest(id: string): Promise<Digest | null> {
  if (!hasSupabase()) return memory.digests.find((d) => d.id === id) ?? null;
  const { data, error } = await db().from("digests").select("*").eq("id", id).maybeSingle<DigestRow>();
  if (error) throw error;
  return data ? toDigest(data) : null;
}

export async function listDigests(limit = 20): Promise<Digest[]> {
  if (!hasSupabase()) return memory.digests.slice(0, limit);
  const { data, error } = await db()
    .from("digests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<DigestRow[]>();
  if (error) throw error;
  return data.map(toDigest);
}
