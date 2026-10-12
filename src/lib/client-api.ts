"use client";

export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number; data?: T };

/** JSON fetch for our own API routes; never throws. */
export async function api<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.status === 401 && typeof window !== "undefined") {
      // Full reload on session expiry so no stale client state survives sign-out.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    if (!res.ok) return { ok: false, error: data?.error ?? `Request failed (${res.status})`, status: res.status, data };
    return { ok: true, data, status: res.status };
  } catch {
    return { ok: false, error: "Network error — check your connection and retry.", status: 0 };
  }
}
