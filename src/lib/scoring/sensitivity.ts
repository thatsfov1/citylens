import { CATEGORIES, type Category, type HexData } from "../../types";
import { bandOf } from "../map/zones";
import { calculatePersonalScore } from "./personal-score";
import { percentileRanks } from "./percentile";
import type { Importance } from "./preferences";
import { normalizeWeights } from "./weights";

/** One nudge = one step of the importance scale. */
const NUDGE = 25;

export type Nudge = { category: Category; direction: "more" | "less"; band: number };

export type Sensitivity = {
  /** Percentile band (0–4) of the area under the user's own preferences. */
  baseBand: number;
  /** True when the band is the same under every one-step nudge. */
  stable: boolean;
  /** Nudges that move the area to another band. */
  fragile: Nudge[];
};

function bandUnder(hexes: HexData[], index: number, importance: Importance): number {
  const weights = normalizeWeights(importance);
  const pct = percentileRanks(hexes.map((h) => calculatePersonalScore(h.scores, weights)));
  return bandOf(pct[index]);
}

/**
 * Does the area keep its match band if one priority is nudged one step up or down?
 * Deterministic, uses only stored category scores. Null when there is nothing to nudge.
 */
export function computeSensitivity(
  hexes: HexData[],
  h3Index: string,
  importance: Importance,
): Sensitivity | null {
  const index = hexes.findIndex((h) => h.h3Index === h3Index);
  if (index < 0 || CATEGORIES.every((c) => importance[c] <= 0)) return null;

  const baseBand = bandUnder(hexes, index, importance);
  const fragile: Nudge[] = [];
  for (const category of CATEGORIES) {
    const current = importance[category];
    const variants: [Nudge["direction"], number][] = [
      ["less", Math.max(0, current - NUDGE)],
      ["more", Math.min(100, current + NUDGE)],
    ];
    for (const [direction, value] of variants) {
      if (value === current) continue; // clamped: nothing changes
      const next = { ...importance, [category]: value };
      if (CATEGORIES.every((c) => next[c] <= 0)) continue;
      const band = bandUnder(hexes, index, next);
      if (band !== baseBand) fragile.push({ category, direction, band });
    }
  }
  return { baseBand, stable: fragile.length === 0, fragile };
}
