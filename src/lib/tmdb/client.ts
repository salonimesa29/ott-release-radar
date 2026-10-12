import "server-only";
import { env } from "@/lib/env";
import { fetchWithRetry } from "@/lib/http";

const BASE = "https://api.themoviedb.org/3";
export const IMAGE_BASE = "https://image.tmdb.org/t/p";

/** GET a TMDB v3 endpoint. Accepts either a v4 Read Access Token (JWT) or a v3 API key. */
export async function tmdbGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const { TMDB_API_KEY } = env("tmdb");
  const url = new URL(BASE + path);
  const headers: Record<string, string> = { accept: "application/json" };
  if (TMDB_API_KEY.startsWith("eyJ")) headers.authorization = `Bearer ${TMDB_API_KEY}`;
  else url.searchParams.set("api_key", TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));

  const res = await fetchWithRetry(url, { headers, cache: "no-store", timeoutMs: 12_000, label: `TMDB ${path}` });
  return (await res.json()) as T;
}

/** Cheap authenticated call used by the health check. */
export async function tmdbPing(): Promise<void> {
  await tmdbGet("/configuration");
}
