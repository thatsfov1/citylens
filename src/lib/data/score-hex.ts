import { haversine, pointInPolygon, type LngLat, type Ring } from "./geo";
import type { District, GreenArea, Poi, PoiCategory } from "./osm";

// Deterministic, explainable per-cell scoring from OSM features.
// Distance bands follow AGENTS.md §9: 0–250 m high, 250–500 medium, 500–1000 lower, >1000 ignored.

export const DISTANCE_BANDS = [
  { maxM: 250, weight: 1 },
  { maxM: 500, weight: 0.6 },
  { maxM: 1000, weight: 0.25 },
] as const;

export const MAX_RADIUS_M = 1000;
const GREEN_COVER_RADIUS_M = 500;
const MAJOR_PARK_M2 = 10_000; // ≥ 1 ha counts as a "park" worth walking to

/** `scale` stretches all bands (2 → 0–500 m full, 500–1000 m medium, 1–2 km lower). */
export function distanceWeight(d: number, scale = 1): number {
  for (const b of DISTANCE_BANDS) if (d <= b.maxM * scale) return b.weight;
  return 0;
}

/** People travel further for culture than for a bus stop, so its reach is doubled. */
export const CATEGORY_DISTANCE_SCALE: Record<PoiCategory, number> = {
  sport: 1,
  culture: 2,
  shopping: 1,
  transport: 1,
};

export type Nearest = { name: string | null; kind: string; distanceM: number; departuresPerHour?: number };

export type PoiIndicators = {
  /** Reach (m) used for this category; absent in rows scored before per-category radii. */
  radiusM?: number;
  raw: number;
  within500: number;
  within1000: number;
  nearest: Nearest | null;
  /** Transport with GTFS data: total weekday departures per hour of all stops within 500 m. */
  departuresPerHourWithin500?: number;
};

export type GreenIndicators = {
  raw: number;
  /** Share (0–1) of the 500 m surroundings covered by green areas. */
  coverShare: number;
  nearestPark: (Nearest & { areaHa: number }) | null;
};

export type CellIndicators = Record<PoiCategory, PoiIndicators> & { greenery: GreenIndicators };

export function scorePoiCategory(center: LngLat, pois: Poi[], scale = 1): PoiIndicators {
  const radiusM = MAX_RADIUS_M * scale;
  let raw = 0;
  let within500 = 0;
  let within1000 = 0;
  let nearest: Nearest | null = null;
  let departures500: number | null = null;
  for (const p of pois) {
    const d = haversine(center, p.at);
    if (d > radiusM) continue;
    raw += p.weight * distanceWeight(d, scale);
    if (d <= 1000) within1000++;
    if (d <= 500) {
      within500++;
      if (p.departuresPerHour !== undefined) departures500 = (departures500 ?? 0) + p.departuresPerHour;
    }
    // Prefer named features for the explanation, falling back to the closest of any kind.
    if (!nearest || d < nearest.distanceM) {
      nearest = { name: p.name, kind: p.kind, distanceM: Math.round(d) };
      if (p.departuresPerHour !== undefined) nearest.departuresPerHour = p.departuresPerHour;
    }
  }
  const out: PoiIndicators = { radiusM, raw, within500, within1000, nearest };
  if (departures500 !== null) out.departuresPerHourWithin500 = Math.round(departures500 * 10) / 10;
  return out;
}

/** Distance in metres from a point to a ring's edge (local planar approximation). */
export function distanceToRingM(p: LngLat, ring: Ring): number {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 110574;
  let best = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const ax = (ring[i - 1][0] - p[0]) * kx;
    const ay = (ring[i - 1][1] - p[1]) * ky;
    const bx = (ring[i][0] - p[0]) * kx;
    const by = (ring[i][1] - p[1]) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** Sample points (centre + 3 rings × 8 bearings) used to estimate green cover around a cell. */
export function samplePoints(center: LngLat, radiusM = GREEN_COVER_RADIUS_M): LngLat[] {
  const pts: LngLat[] = [center];
  const kx = 111320 * Math.cos((center[1] * Math.PI) / 180);
  const ky = 110574;
  for (const f of [1 / 3, 2 / 3, 1]) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      pts.push([center[0] + (Math.cos(a) * radiusM * f) / kx, center[1] + (Math.sin(a) * radiusM * f) / ky]);
    }
  }
  return pts;
}

const inBBox = (p: LngLat, b: GreenArea["bbox"], padDeg = 0) =>
  p[0] >= b[0] - padDeg && p[0] <= b[2] + padDeg && p[1] >= b[1] - padDeg && p[1] <= b[3] + padDeg;

export function scoreGreenery(center: LngLat, areas: GreenArea[]): GreenIndicators {
  // ~0.02° ≈ 1.4–2.2 km: cheap bbox prefilter before exact geometry tests.
  const nearby = areas.filter((a) => inBBox(center, a.bbox, 0.02));

  const samples = samplePoints(center);
  const covered = samples.filter((s) => nearby.some((a) => inBBox(s, a.bbox) && a.polygons.some((poly) => pointInPolygon(s, poly)))).length;
  const coverShare = covered / samples.length;

  let nearestPark: GreenIndicators["nearestPark"] = null;
  for (const a of nearby) {
    if (a.areaM2 < MAJOR_PARK_M2) continue;
    const d = a.polygons.some((poly) => pointInPolygon(center, poly))
      ? 0
      : Math.min(...a.polygons.map((poly) => distanceToRingM(center, poly[0])));
    if (d <= MAX_RADIUS_M && (!nearestPark || d < nearestPark.distanceM)) {
      nearestPark = { name: a.name, kind: "green_area", distanceM: Math.round(d), areaHa: Math.round(a.areaM2 / 1000) / 10 };
    }
  }

  const proximity = nearestPark ? Math.max(0, 1 - nearestPark.distanceM / MAX_RADIUS_M) : 0;
  return { raw: 0.6 * coverShare + 0.4 * proximity, coverShare, nearestPark };
}

/** District containing the point, or the one with the nearest boundary as a fallback. */
export function findDistrict(center: LngLat, districts: District[]): string | null {
  for (const d of districts) {
    if (inBBox(center, d.bbox) && d.polygons.some((poly) => pointInPolygon(center, poly))) return d.name;
  }
  let best: { name: string; d: number } | null = null;
  for (const d of districts) {
    const dist = Math.min(...d.polygons.map((poly) => distanceToRingM(center, poly[0])));
    if (!best || dist < best.d) best = { name: d.name, d: dist };
  }
  return best?.name ?? null;
}

/**
 * Maps raw per-cell values to 0–100. Log-compressed and anchored at the 95th percentile so a
 * few dense hot spots don't flatten the rest of the city. Monotonic: ordering of cells is preserved.
 */
export function normalizeRaw(raw: number[]): number[] {
  const sorted = [...raw].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(0.95 * (sorted.length - 1))] ?? 0;
  if (p95 <= 0) return raw.map(() => 0);
  const denom = Math.log1p(p95);
  return raw.map((v) => Math.round(100 * Math.min(1, Math.log1p(v) / denom)));
}
