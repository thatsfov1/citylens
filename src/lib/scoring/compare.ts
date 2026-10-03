import { CATEGORIES, type Category, type CategoryWeights, type HexData } from "../../types";
import { calculatePersonalScore } from "./personal-score";

export const MAX_COMPARED = 3;

export type CompareArea = { h3Index: string; district: string | null; match: number };

export type CompareRow = {
  category: Category;
  weight: number;
  /** Category score per area, in the same order as `areas`. */
  values: number[];
  /** True where the area has the highest value in the row (nobody leads when all are equal). */
  leads: boolean[];
};

export type Comparison = { areas: CompareArea[]; rows: CompareRow[]; matchLeads: boolean[] };

const leaders = (values: number[]) => {
  const max = Math.max(...values);
  const tied = values.every((v) => v === max);
  return values.map((v) => !tied && v === max);
};

/** Side-by-side category scores for the chosen areas, rows ordered by the user's weights. Deterministic, stored scores only. */
export function compareAreas(hexes: HexData[], ids: string[], weights: CategoryWeights): Comparison {
  const chosen = ids.map((id) => hexes.find((h) => h.h3Index === id)).filter((h): h is HexData => !!h);
  const areas = chosen.map((h) => ({
    h3Index: h.h3Index,
    district: h.district ?? null,
    match: Math.round(calculatePersonalScore(h.scores, weights)),
  }));
  const rows = [...CATEGORIES]
    .sort((a, b) => weights[b] - weights[a])
    .map((category) => {
      const values = chosen.map((h) => h.scores[category]);
      return { category, weight: weights[category], values, leads: leaders(values) };
    });
  return { areas, rows, matchLeads: leaders(areas.map((a) => a.match)) };
}
