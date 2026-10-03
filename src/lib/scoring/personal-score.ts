import {
  CATEGORIES,
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
  mode: MapMode,
): number {
  return mode === "forYou" ? calculatePersonalScore(scores, weights) : scores[mode];
}
