/** fetch with a timeout and bounded retries for transient failures (429, 5xx, network). */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public transient: boolean,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchWithRetry(
  url: string | URL,
  init: RequestInit & { timeoutMs?: number; retries?: number; label?: string } = {},
): Promise<Response> {
  const { timeoutMs = 10_000, retries = 2, label = "request", ...rest } = init;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      const transient = res.status === 429 || res.status >= 500;
      if (!transient || attempt === retries) {
        throw new HttpError(res.status, `${label} failed with HTTP ${res.status}`, transient);
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : backoff(attempt));
    } catch (err) {
      if (err instanceof HttpError) throw err;
      lastError = err;
      if (attempt === retries) break;
      await sleep(backoff(attempt));
    }
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new HttpError(0, `${label} failed: ${reason}`, true);
}

const backoff = (attempt: number) => 400 * 2 ** attempt + Math.random() * 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run async jobs with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
