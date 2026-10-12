/**
 * Streaming-provider mapping. Matching uses stable TMDB provider / network IDs first;
 * name patterns are a fallback because catalogue names change (e.g. Disney+ Hotstar → JioHotstar).
 *
 * Override the IDs without a code change by setting PROVIDER_MAP_JSON, e.g.
 *   {"hotstar":{"providerIds":[122,2336]}}
 */
export const PROVIDER_KEYS = ["netflix", "prime_video", "hotstar"] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

export interface ProviderConfig {
  key: ProviderKey;
  label: string;
  shortLabel: string;
  /** TMDB watch-provider IDs (India region) that count as this platform. */
  providerIds: number[];
  /** TMDB TV network IDs whose premieres are streaming premieres on this platform. */
  networkIds: number[];
  /** Fallback name patterns for providers/networks. */
  namePattern: RegExp;
  color: string;
}

const DEFAULTS: Record<ProviderKey, ProviderConfig> = {
  netflix: {
    key: "netflix",
    label: "Netflix",
    shortLabel: "Netflix",
    providerIds: [8, 1796],
    networkIds: [213],
    namePattern: /^netflix( basic with ads| standard with ads)?$/i,
    color: "#e5484d",
  },
  prime_video: {
    key: "prime_video",
    label: "Amazon Prime Video",
    shortLabel: "Prime Video",
    providerIds: [119, 2100],
    networkIds: [1024],
    namePattern: /^(amazon )?prime video( with ads)?$|^amazon$/i,
    color: "#4fb3ff",
  },
  hotstar: {
    key: "hotstar",
    label: "Disney+ Hotstar",
    shortLabel: "Hotstar",
    providerIds: [122, 2336],
    networkIds: [3919, 5236],
    namePattern: /hotstar/i,
    color: "#7d8cff",
  },
};

function load(): Record<ProviderKey, ProviderConfig> {
  const raw = typeof process !== "undefined" ? process.env.PROVIDER_MAP_JSON : undefined;
  if (!raw) return DEFAULTS;
  try {
    const override = JSON.parse(raw) as Partial<Record<ProviderKey, Partial<Pick<ProviderConfig, "providerIds" | "networkIds">>>>;
    const merged = { ...DEFAULTS };
    for (const key of PROVIDER_KEYS) {
      const o = override[key];
      if (o) merged[key] = { ...merged[key], ...o };
    }
    return merged;
  } catch {
    console.error("PROVIDER_MAP_JSON is not valid JSON; using defaults");
    return DEFAULTS;
  }
}

export const PROVIDERS = load();
export const PROVIDER_LIST = PROVIDER_KEYS.map((k) => PROVIDERS[k]);

export function providerKeyForId(id: number): ProviderKey | null {
  return PROVIDER_LIST.find((p) => p.providerIds.includes(id))?.key ?? null;
}

export function providerKeyForName(name: string): ProviderKey | null {
  return PROVIDER_LIST.find((p) => p.namePattern.test(name.trim()))?.key ?? null;
}

/** Resolve a TMDB provider entry: ID first, name as fallback. */
export function resolveProvider(entry: { provider_id: number; provider_name: string }): ProviderKey | null {
  return providerKeyForId(entry.provider_id) ?? providerKeyForName(entry.provider_name);
}

/** Resolve a TMDB TV network: ID first, name as fallback. */
export function resolveNetwork(network: { id: number; name: string }): ProviderKey | null {
  return (
    PROVIDER_LIST.find((p) => p.networkIds.includes(network.id))?.key ??
    providerKeyForName(network.name)
  );
}
