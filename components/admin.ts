"use client";

const KEY = "radar-admin-key";

export function adminHeaders(): Record<string, string> {
  try {
    const k = localStorage.getItem(KEY);
    return k ? { "x-admin-key": k } : {};
  } catch {
    return {};
  }
}

/** POST/PUT JSON; on 401 asks for the admin key once and retries. */
export async function adminFetch(url: string, method: string, body: unknown): Promise<Response> {
  const send = () =>
    fetch(url, {
      method,
      headers: { "content-type": "application/json", ...adminHeaders() },
      body: JSON.stringify(body),
    });
  let res = await send();
  if (res.status === 401) {
    const k = window.prompt("Admin key");
    if (!k) return res;
    try {
      localStorage.setItem(KEY, k);
    } catch {}
    res = await send();
  }
  return res;
}
