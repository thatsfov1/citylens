import { CATEGORIES, type CategoryWeights } from "../../types";

/** Raw per-category importance (0–100) → weights summing to 1. */
export function normalizeWeights(
  importance: Record<keyof CategoryWeights, number>,
): CategoryWeights {
  const total = CATEGORIES.reduce((sum, c) => sum + Math.max(0, importance[c]), 0);
  const out = {} as CategoryWeights;
  for (const c of CATEGORIES) {
    out[c] = total > 0 ? Math.max(0, importance[c]) / total : 1 / CATEGORIES.length;
  }
  return out;
}
