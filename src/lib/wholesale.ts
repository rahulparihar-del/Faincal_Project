import { WholesaleSale } from "./types";

/**
 * Total bill value for a wholesale order. Prefers the new `billAmount` field
 * and falls back to legacy line items so older records keep working.
 */
export function wholesaleTotal(w: WholesaleSale): number {
  if (typeof w.billAmount === "number" && !Number.isNaN(w.billAmount)) {
    return w.billAmount;
  }
  return (w.items ?? []).reduce((sum, i) => sum + i.qty * i.rate, 0);
}
