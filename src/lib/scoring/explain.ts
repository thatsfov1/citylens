import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type CategoryScores,
  type CategoryWeights,
} from "../../types";
import { calculatePersonalScore } from "./personal-score";

export type MatchLevel = "strong" | "moderate" | "weak";

export type Explanation = {
  score: number;
  level: MatchLevel;
  headline: string;
  reasons: string[];
  considerations: string[];
};

const PRIORITY_WEIGHT = 0.15; // a category counts as "important" above this
const HIGH = 65;
const LOW = 45;

export function matchLevel(score: number): MatchLevel {
  return score >= 70 ? "strong" : score >= 45 ? "moderate" : "weak";
}

const HEADLINES: Record<MatchLevel, string> = {
  strong: "Strong match for your preferences",
  moderate: "Partial match for your preferences",
  weak: "Weaker match for your preferences",
};

/** Deterministic explanation derived only from category scores and weights. */
export function explainMatch(
  scores: CategoryScores,
  weights: CategoryWeights,
): Explanation {
  const score = Math.round(calculatePersonalScore(scores, weights));
  const level = matchLevel(score);

  // Most important categories first.
  const byWeight = [...CATEGORIES].sort((a, b) => weights[b] - weights[a]);
  const important = byWeight.filter((c) => weights[c] >= PRIORITY_WEIGHT);

  const reasons: string[] = [];
  const considerations: string[] = [];

  for (const c of important) {
    const label = CATEGORY_LABELS[c];
    if (scores[c] >= HIGH) {
      reasons.push(
        c === byWeight[0]
          ? `Strong ${label.toLowerCase()} score aligns with your top priority.`
          : `${label} also matches your preferences well.`,
      );
    } else if (scores[c] < LOW) {
      considerations.push(
        `${label} availability is below what you asked for in this area.`,
      );
    }
  }

  // Low-priority categories that are weak don't matter; strong ones are a bonus.
  const bonus = CATEGORIES.filter(
    (c: Category) => weights[c] < PRIORITY_WEIGHT && scores[c] >= 80,
  );
  for (const c of bonus) {
    reasons.push(`Bonus: ${CATEGORY_LABELS[c].toLowerCase()} is also strong here.`);
  }

  if (reasons.length === 0) {
    reasons.push("No single priority stands out here — it is a balanced, moderate fit.");
  }

  return { score, level, headline: HEADLINES[level], reasons, considerations };
}
