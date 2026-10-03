import { CATEGORIES, type Category, type CategoryWeights, type HexData } from "../../types";
import { calculatePersonalScore, type Scorer } from "./personal-score";

export const MAX_COMPARED = 3;

export type CompareArea = {
  h3Index: string;
  district: string | null;
  /** Column title: the district, numbered when several chosen areas share it ("Podgórze 1", "Podgórze 2"). */
  label: string;
  match: number;
};

export type CompareRow = {
  category: Category;
  weight: number;
  /** Category score per area, in the same order as `areas`. */
  values: number[];
  /** True where the area has the highest value in the row (nobody leads when all are equal). */
  leads: boolean[];
};

export type CompareSummary =
  /** Match scores within `CLOSE_GAP` points: no winner is declared. */
  | { kind: "close" }
  | { kind: "leader"; index: number; gap: number; driver: Category | null };

export type Comparison = { areas: CompareArea[]; rows: CompareRow[]; matchLeads: boolean[]; summary: CompareSummary | null };

const CLOSE_GAP = 3;

const leaders = (values: number[]) => {
  const max = Math.max(...values);
  const tied = values.every((v) => v === max);
  return values.map((v) => !tied && v === max);
};

/** Side-by-side category scores for the chosen areas, rows ordered by the user's weights. Deterministic, stored scores only. */
export function compareAreas(
  hexes: HexData[],
  ids: string[],
  weights: CategoryWeights,
  score: Scorer = (s) => calculatePersonalScore(s, weights),
): Comparison {
  const chosen = ids.map((id) => hexes.find((h) => h.h3Index === id)).filter((h): h is HexData => !!h);
  const base = chosen.map((h, i) => h.district ?? `Area ${i + 1}`);
  const seen = new Map<string, number>();
  const areas = chosen.map((h, i) => {
    const n = (seen.get(base[i]) ?? 0) + 1;
    seen.set(base[i], n);
    const shared = base.filter((b) => b === base[i]).length > 1;
    return {
      h3Index: h.h3Index,
      district: h.district ?? null,
      label: shared ? `${base[i]} ${n}` : base[i],
      match: Math.round(score(h.scores)),
    };
  });
  const rows = CATEGORIES.map((category) => {
    const values = chosen.map((h) => h.scores[category]);
    return { category, weight: weights[category], values, leads: leaders(values) };
  });
  // Rows that decide the comparison first: weight × spread between the areas, then by weight.
  const impact = (r: CompareRow) => r.weight * (Math.max(...r.values) - Math.min(...r.values));
  rows.sort((a, b) => impact(b) - impact(a) || b.weight - a.weight);

  let summary: CompareSummary | null = null;
  if (areas.length >= 2) {
    const matches = areas.map((a) => a.match);
    const best = matches.indexOf(Math.max(...matches));
    const gap = matches[best] - Math.max(...matches.filter((_, i) => i !== best));
    if (gap < CLOSE_GAP) summary = { kind: "close" };
    else {
      // The category that adds most to the leader's lead over the average of the others, weighted by importance.
      const lift = (r: CompareRow) => {
        const others = r.values.filter((_, i) => i !== best);
        return r.weight * (r.values[best] - others.reduce((x, y) => x + y, 0) / others.length);
      };
      const top = rows.reduce((m, r) => (lift(r) > lift(m) ? r : m));
      summary = { kind: "leader", index: best, gap, driver: lift(top) > 0 ? top.category : null };
    }
  }
  return { areas, rows, matchLeads: leaders(areas.map((a) => a.match)), summary };
}
