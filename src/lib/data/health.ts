import { haversine, type LngLat } from "./geo";
import { distanceWeight } from "./score-hex";

// Health and everyday-services access per cell (0–100, higher = more of it within reach). Deterministic and sourced:
// every number stored in `indicators.health` comes from data/health/features.json (OpenStreetMap points). It counts
// what is MAPPED nearby: not opening hours, queues, quality or whether a doctor accepts new patients, and it is
// not a verdict on a neighbourhood (AGENTS.md §3). Information only: it never enters the weighted score.

export const HEALTH_KINDS = ["pharmacy", "doctor", "hospital", "post", "bank"] as const;
export type HealthKind = (typeof HEALTH_KINDS)[number];

/** data/health/features.json: [lng, lat, index into `kinds`]. */
export type HealthFeaturesFile = {
  source: string;
  fetched: string;
  kinds: HealthKind[];
  points: [lng: number, lat: number, kind: number][];
};

/** Reach multiplier on the usual bands (0–250 m full, 250–500 m ×0.6, 500–1000 m ×0.25): a hospital is travelled to. */
export const HEALTH_SCALE: Record<HealthKind, number> = { pharmacy: 1, doctor: 1, hospital: 3, post: 1, bank: 1 };

/** How much each kind counts towards the combined score. A judgement call, shown to the user in the panel. */
export const HEALTH_WEIGHTS: Record<HealthKind, number> = { pharmacy: 0.3, doctor: 0.3, hospital: 0.15, post: 0.15, bank: 0.1 };

export type HealthIndicator = {
  /** Distance-weighted count within the reach; the basis for the percentile score. */
  raw: number;
  within500: number;
  within1000: number;
  /** Metres to the nearest one within the reach; null when none that close. */
  nearestM: number | null;
  /** Percentile rank (0–100) of `raw` among all cells; filled in after every cell is scored. */
  score?: number;
};
export type HealthIndicators = Record<HealthKind, HealthIndicator>;

export function scoreHealth(center: LngLat, file: HealthFeaturesFile): HealthIndicators {
  const out = Object.fromEntries(
    HEALTH_KINDS.map((k) => [k, { raw: 0, within500: 0, within1000: 0, nearestM: null } as HealthIndicator]),
  ) as HealthIndicators;
  const maxReach = 1000 * Math.max(...Object.values(HEALTH_SCALE));
  const dLat = maxReach / 110574;
  const dLng = maxReach / (111320 * Math.cos((center[1] * Math.PI) / 180));
  for (const [lng, lat, k] of file.points) {
    if (Math.abs(lat - center[1]) > dLat || Math.abs(lng - center[0]) > dLng) continue;
    const kind = file.kinds[k];
    const scale = HEALTH_SCALE[kind];
    const d = haversine(center, [lng, lat]);
    if (d > 1000 * scale) continue;
    const ind = out[kind];
    ind.raw += distanceWeight(d, scale);
    if (d <= 1000) ind.within1000++;
    if (d <= 500) ind.within500++;
    if (ind.nearestM === null || d < ind.nearestM) ind.nearestM = Math.round(d);
  }
  for (const k of HEALTH_KINDS) out[k].raw = Math.round(out[k].raw * 1000) / 1000;
  return out;
}

/** Weighted mean of the per-kind scores. Every kind has a score for every cell, so no renormalisation is needed. */
export function combineHealth(scores: Record<HealthKind, number>): number {
  return Math.round(HEALTH_KINDS.reduce((s, k) => s + scores[k] * HEALTH_WEIGHTS[k], 0));
}
