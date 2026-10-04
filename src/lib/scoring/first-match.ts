import { CATEGORIES, type Category, type CategoryWeights, type HexData, type Place, type PlacesResponse } from "../../types";
import { calculatePersonalScore } from "./personal-score";

/** Share of cells offered as "first matches": the top 10% by personal score. */
export const TOP_SHARE = 0.1;

/**
 * h3 indexes of the strongest matches, best first. Cells below the user's minimum safety level are skipped
 * (cells without safety data are not). Ties break by h3 index so the order is deterministic.
 */
export function strongestAreas(hexes: HexData[], weights: CategoryWeights, minSafety = 0): string[] {
  const eligible = hexes.filter((h) => !(minSafety > 0 && h.safety != null && h.safety < minSafety));
  return eligible
    .map((h) => ({ id: h.h3Index, score: calculatePersonalScore(h.scores, weights) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.ceil(hexes.length * TOP_SHARE)))
    .map((x) => x.id);
}

export type Contributor =
  | { category: Exclude<Category, "greenery">; place: Place }
  | { category: "greenery"; name: string | null; areaHa: number };

/**
 * One real place behind the area's score, from the user's highest-weighted category that has one nearby:
 * the nearest place, or the largest green area for greenery. Null when nothing is in reach.
 */
export function topContributor(places: PlacesResponse, weights: CategoryWeights): Contributor | null {
  const byWeight = [...CATEGORIES].sort((a, b) => weights[b] - weights[a]);
  for (const c of byWeight) {
    if (weights[c] <= 0) continue;
    if (c === "greenery") {
      const parks = places.green.features
        .map((f) => ({ name: (f.properties?.name as string | null) ?? null, areaHa: Number(f.properties?.areaHa) }))
        .filter((p) => Number.isFinite(p.areaHa))
        .sort((a, b) => b.areaHa - a.areaHa);
      if (parks[0]) return { category: "greenery", ...parks[0] };
      continue;
    }
    const nearest = places.places.filter((p) => p.category === c).sort((a, b) => a.distanceM - b.distanceM)[0];
    if (nearest) return { category: c, place: nearest };
  }
  return null;
}
