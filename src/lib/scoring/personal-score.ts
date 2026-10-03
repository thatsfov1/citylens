import {
  CATEGORIES,
  type Category,
  type CategoryScores,
  type CategoryWeights,
  type MapMode,
} from "../../types";

/** Weighted sum of category scores (0–100 when weights sum to 1). */
export function calculatePersonalScore(
  scores: CategoryScores,
  weights: CategoryWeights,
): number {
  return CATEGORIES.reduce((sum, c) => sum + scores[c] * weights[c], 0);
}

/** Value displayed on the map for the given mode. */
export function getModeScore(
  scores: CategoryScores,
  weights: CategoryWeights,
  mode: Exclude<MapMode, "safety">,
): number {
  return mode === "forYou" ? calculatePersonalScore(scores, weights) : scores[mode];
}

/** Categories the user wants LESS of (e.g. quiet: few shops or nightlife). Their importance still says how much. */
export type Avoid = ReadonlySet<Category>;
export type Scorer = (scores: CategoryScores) => number;

/** Points per standard deviation: a hex one deviation better than the city on every priority scores 75. */
const SPREAD = 25;

/**
 * Personal match relative to the city: each category is measured in standard deviations from the city mean
 * (so a category where every hex scores 90–100 can't decide the result just because it is the biggest number),
 * flipped for categories the user wants less of, then weighted. 50 = typical for the city; clamped to 0–100.
 * Deterministic: the baseline is the hexes passed in.
 */
export function createScorer(
  hexes: readonly { scores: CategoryScores }[],
  weights: CategoryWeights,
  avoid: Avoid = new Set(),
): Scorer {
  if (hexes.length === 0) return (scores) => calculatePersonalScore(scores, weights);
  const base = Object.fromEntries(
    CATEGORIES.map((c) => {
      const values = hexes.map((h) => h.scores[c]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
      return [c, { mean, std: Math.max(Math.sqrt(variance), 1) }];
    }),
  ) as Record<Category, { mean: number; std: number }>;
  return (scores) => {
    const z = CATEGORIES.reduce((sum, c) => {
      const d = (scores[c] - base[c].mean) / base[c].std;
      return sum + weights[c] * (avoid.has(c) ? -d : d);
    }, 0);
    return Math.min(100, Math.max(0, 50 + SPREAD * z));
  };
}
