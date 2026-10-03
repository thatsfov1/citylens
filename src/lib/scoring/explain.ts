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
  strong: "Mocne dopasowanie do Twoich preferencji",
  moderate: "Częściowe dopasowanie do Twoich preferencji",
  weak: "Słabsze dopasowanie do Twoich preferencji",
};

/** Deterministic explanation derived only from category scores and weights. */
export function explainMatch(
  scores: CategoryScores,
  weights: CategoryWeights,
  /** Optional data-backed sentences per category (see facts.ts); used instead of generic text. */
  facts?: Record<Category, string>,
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
        facts
          ? `${label}: ${facts[c]}.`
          : c === byWeight[0]
            ? `Wysoki wynik w kategorii „${label.toLowerCase()}” odpowiada Twojemu głównemu priorytetowi.`
            : `Kategoria „${label.toLowerCase()}” również dobrze odpowiada Twoim preferencjom.`,
      );
    } else if (scores[c] < LOW) {
      considerations.push(
        facts
          ? `${label} poniżej Twoich oczekiwań: ${facts[c]}.`
          : `Dostępność w kategorii „${label.toLowerCase()}” jest w tym obszarze poniżej Twoich oczekiwań.`,
      );
    }
  }

  // Low-priority categories that are weak don't matter; strong ones are a bonus.
  const bonus = CATEGORIES.filter(
    (c: Category) => weights[c] < PRIORITY_WEIGHT && scores[c] >= 80,
  );
  for (const c of bonus) {
    reasons.push(`Dodatkowo: kategoria „${CATEGORY_LABELS[c].toLowerCase()}” również wypada tu mocno.`);
  }

  if (reasons.length === 0) {
    reasons.push("Żaden priorytet nie wyróżnia się tutaj. To wyważone, umiarkowane dopasowanie.");
  }

  return { score, level, headline: HEADLINES[level], reasons, considerations };
}
