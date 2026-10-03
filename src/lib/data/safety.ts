import { haversine, type LngLat } from "./geo";

// Safety indicators per cell (0–100, higher = more indicators in favour). Deterministic and sourced:
// every number stored in `indicators.safety` can be traced to a file in data/safety/. The score describes the
// surroundings (street lighting) and, when a real dataset is provided, official crime statistics — it is NOT a
// verdict on a neighbourhood (AGENTS.md §3).

// ---- Lighting (OpenStreetMap `lit` tags) ----------------------------------------------------------------

export type LightingFile = { source: string; fetched: string; points: [lng: number, lat: number, lit: 0 | 1][] };

export type LightingIndicator = {
  /** Street segments with an explicit lit/unlit tag within the radius. */
  segments: number;
  /** Of those, how many are tagged lit. */
  lit: number;
  /** Share of tagged segments that are lit, smoothed toward the city average for small samples (0–1). */
  litShare: number;
};

export const LIGHTING_RADIUS_M = 700;
/** Below this many tagged segments we say "no data" rather than guess. */
export const MIN_LIGHTING_SEGMENTS = 8;
/** Pseudo-count pulling small samples toward the city-wide share. */
const SMOOTHING = 10;

export function cityLitShare(file: LightingFile): number {
  return file.points.length === 0 ? 0 : file.points.reduce((s, p) => s + p[2], 0) / file.points.length;
}

export function scoreLighting(center: LngLat, file: LightingFile, cityShare: number): LightingIndicator | null {
  // Cheap box test before the exact distance.
  const dLat = LIGHTING_RADIUS_M / 110574;
  const dLng = LIGHTING_RADIUS_M / (111320 * Math.cos((center[1] * Math.PI) / 180));
  let segments = 0;
  let lit = 0;
  for (const [lng, lat, isLit] of file.points) {
    if (Math.abs(lat - center[1]) > dLat || Math.abs(lng - center[0]) > dLng) continue;
    if (haversine(center, [lng, lat]) > LIGHTING_RADIUS_M) continue;
    segments++;
    lit += isLit;
  }
  if (segments < MIN_LIGHTING_SEGMENTS) return null;
  return { segments, lit, litShare: (lit + SMOOTHING * cityShare) / (segments + SMOOTHING) };
}

// ---- Official crime statistics (optional dataset) --------------------------------------------------------

/**
 * data/safety/crime.json — real, sourced data only. Each area lists the OSM district names it covers
 * (names as in hex_scores.district), reported crimes in `year` and residents. Not shipped yet: no machine-readable
 * police dataset for Kraków was found, and press figures are partial.
 */
export type CrimeFile = {
  source: string;
  sourceUrl: string;
  year: number;
  /** What was counted, e.g. "theft, burglary, robbery, assault". */
  categories: string;
  areas: { name: string; districts: string[]; crimes: number; residents: number }[];
};

export type CrimeIndicator = {
  area: string;
  year: number;
  /** Reported crimes per 1,000 residents in the police area covering this cell. */
  per1000: number;
  /** City-wide figure for comparison. */
  cityPer1000: number;
};

export function crimeIndicator(district: string | null, file: CrimeFile): CrimeIndicator | null {
  if (!district) return null;
  const area = file.areas.find((a) => a.districts.includes(district));
  if (!area || area.residents <= 0) return null;
  const total = file.areas.reduce((s, a) => ({ c: s.c + a.crimes, r: s.r + a.residents }), { c: 0, r: 0 });
  return {
    area: area.name,
    year: file.year,
    per1000: Math.round((1000 * area.crimes) / area.residents * 10) / 10,
    cityPer1000: Math.round((1000 * total.c) / total.r * 10) / 10,
  };
}

// ---- Combination -----------------------------------------------------------------------------------------

export type SafetyIndicators = {
  lighting?: LightingIndicator;
  crime?: CrimeIndicator;
};

/** Weights of the indicators; renormalised over the ones that have data for a cell. */
export const SAFETY_WEIGHTS = { crime: 0.6, lighting: 0.4 } as const;

/** Percentile rank (0–100) of each value; ties share a rank. Higher value → higher rank. */
export function rankScores(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    if (sorted.length <= 1) return 50;
    const below = sorted.filter((x) => x < v).length;
    const equal = sorted.filter((x) => x === v).length;
    return Math.round((100 * (below + (equal - 1) / 2)) / (sorted.length - 1));
  });
}

/**
 * Combines per-indicator scores (already 0–100, higher = better) into one cell score, or null when the cell
 * has no safety data at all.
 */
export function combineSafety(parts: { crime?: number; lighting?: number }): number | null {
  let sum = 0;
  let weight = 0;
  for (const k of ["crime", "lighting"] as const) {
    const v = parts[k];
    if (v === undefined) continue;
    sum += v * SAFETY_WEIGHTS[k];
    weight += SAFETY_WEIGHTS[k];
  }
  return weight === 0 ? null : Math.round(sum / weight);
}
