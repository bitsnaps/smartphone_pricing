import raw from "./retail_reference.json";

export interface RetailRefEntry {
  /** median new-device retail price, DZD */
  median: number;
  /** number of store listings behind the median */
  n: number;
}

interface RetailRefData {
  updated: string;
  currency: string;
  condition: string;
  min_listings: number;
  note: string;
  entries: Record<string, RetailRefEntry>;
}

const data = raw as unknown as RetailRefData;

/**
 * Median retail (store) price for a brand/tier/storage combo, collected from
 * multiple public sources. `tier` uses the form vocabulary; "none" maps to the
 * reference table's base bucket. Returns null when no confident reference
 * (fewer than min_listings) exists for the combo.
 */
export function retailRefFor(
  brand: string,
  tier: string,
  storageGb: number | null,
): RetailRefEntry | null {
  if (!storageGb) return null;
  const key = `${brand}|${tier === "none" ? "base" : tier}|${storageGb}`;
  return data.entries[key] ?? null;
}

export const retailRefUpdated = data.updated;
