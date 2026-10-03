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

// ---- Street environment features (OpenStreetMap points) --------------------------------------------------

// Road-safety data (crossings, traffic calming, major roads, accidents) is deliberately NOT used: the question
// users ask is about being out at night and about crime, not about traffic.
export const SAFETY_FEATURE_KINDS = ["police", "fire_station", "hospital", "cctv", "nightlife"] as const;
export type SafetyFeatureKind = (typeof SAFETY_FEATURE_KINDS)[number];

/** data/safety/features.json: [lng, lat, index into `kinds`]. */
export type FeaturesFile = {
  source: string;
  fetched: string;
  kinds: SafetyFeatureKind[];
  points: [lng: number, lat: number, kind: number][];
};

export type CctvIndicator = { cameras: number };
/** Distance in metres to the nearest service within EMERGENCY_REACH_M; null when none that close. */
export type EmergencyIndicator = { police: number | null; fire: number | null; hospital: number | null };
/** Context only, NOT part of the score: bars, pubs and nightclubs nearby. */
export type NightlifeIndicator = { venues: number };

export const CCTV_RADIUS_M = 500;
export const EMERGENCY_REACH_M = 3000;
export const NIGHTLIFE_RADIUS_M = 300;

export type NearFeatures = { cctv: CctvIndicator; emergency: EmergencyIndicator; nightlife: NightlifeIndicator };

const MAX_REACH = Math.max(EMERGENCY_REACH_M, CCTV_RADIUS_M, NIGHTLIFE_RADIUS_M);

export function scoreFeatures(center: LngLat, file: FeaturesFile): NearFeatures {
  const dLat = MAX_REACH / 110574;
  const dLng = MAX_REACH / (111320 * Math.cos((center[1] * Math.PI) / 180));
  const near: NearFeatures = {
    cctv: { cameras: 0 },
    emergency: { police: null, fire: null, hospital: null },
    nightlife: { venues: 0 },
  };
  const nearest = (cur: number | null, d: number) => (cur === null || d < cur ? Math.round(d) : cur);
  for (const [lng, lat, k] of file.points) {
    if (Math.abs(lat - center[1]) > dLat || Math.abs(lng - center[0]) > dLng) continue;
    const d = haversine(center, [lng, lat]);
    switch (file.kinds[k]) {
      case "cctv":
        if (d <= CCTV_RADIUS_M) near.cctv.cameras++;
        break;
      case "nightlife":
        if (d <= NIGHTLIFE_RADIUS_M) near.nightlife.venues++;
        break;
      case "police":
        if (d <= EMERGENCY_REACH_M) near.emergency.police = nearest(near.emergency.police, d);
        break;
      case "fire_station":
        if (d <= EMERGENCY_REACH_M) near.emergency.fire = nearest(near.emergency.fire, d);
        break;
      case "hospital":
        if (d <= EMERGENCY_REACH_M) near.emergency.hospital = nearest(near.emergency.hospital, d);
        break;
    }
  }
  return near;
}

/** Raw values used for ranking cells against each other (higher = more in favour of safety). */
export const cctvRaw = (c: CctvIndicator) => c.cameras;
/** 0–1: closer police / fire / hospital score higher (police 0.4, fire 0.3, hospital 0.3). */
export function emergencyRaw(e: EmergencyIndicator): number {
  const prox = (d: number | null) => (d === null ? 0 : Math.max(0, 1 - d / EMERGENCY_REACH_M));
  return 0.4 * prox(e.police) + 0.3 * prox(e.fire) + 0.3 * prox(e.hospital);
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

export const SAFETY_PARTS = ["crime", "lighting", "cctv", "emergency"] as const;
export type SafetyPart = (typeof SAFETY_PARTS)[number];

export type SafetyIndicators = {
  lighting?: LightingIndicator;
  cctv?: CctvIndicator;
  emergency?: EmergencyIndicator;
  /** Context shown to the user; not part of the score. */
  nightlife?: NightlifeIndicator;
  crime?: CrimeIndicator;
  /** Score (0–100, higher = more in favour) of each indicator that fed the combined safety score. */
  parts?: Partial<Record<SafetyPart, number>>;
};

/** Weights of the indicators; renormalised over the ones that have data for a cell. */
export const SAFETY_WEIGHTS: Record<SafetyPart, number> = {
  crime: 0.4, // only when a real dataset is provided (data/safety/crime.json)
  lighting: 0.5,
  cctv: 0.25,
  emergency: 0.25,
};

/** Share (0–1) each present indicator contributes to the combined score. */
export function partShares(parts: Partial<Record<SafetyPart, number>>): Partial<Record<SafetyPart, number>> {
  const present = SAFETY_PARTS.filter((k) => parts[k] !== undefined);
  const total = present.reduce((s, k) => s + SAFETY_WEIGHTS[k], 0);
  return Object.fromEntries(present.map((k) => [k, SAFETY_WEIGHTS[k] / total]));
}

/** A cell is built-up (so safety indicators mean something) if it has lighting data or a mapped camera nearby. */
export function hasStreets(ind: SafetyIndicators): boolean {
  return ind.lighting !== undefined || (ind.cctv?.cameras ?? 0) > 0;
}

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
export function combineSafety(parts: Partial<Record<SafetyPart, number>>): number | null {
  let sum = 0;
  let weight = 0;
  for (const k of SAFETY_PARTS) {
    const v = parts[k];
    if (v === undefined) continue;
    sum += v * SAFETY_WEIGHTS[k];
    weight += SAFETY_WEIGHTS[k];
  }
  return weight === 0 ? null : Math.round(sum / weight);
}
