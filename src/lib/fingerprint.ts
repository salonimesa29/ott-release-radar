import { createHash } from "node:crypto";

/** Stable short hash of a JSON-serialisable value (object keys sorted). */
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex").slice(0, 24);
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}
