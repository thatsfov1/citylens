import { haversine, type LngLat } from "./geo";

// Air-quality indicators per cell (0–100, higher = cleaner air). Deterministic and sourced: every number comes
// from data/air/stations.json (GIOŚ stations). A cell's value is INTERPOLATED from the few stations around it —
// it is not a measurement at that spot, and it describes the air, not the neighbourhood (AGENTS.md §3).

export type AirStation = {
  id: number;
  name: string;
  lng: number;
  lat: number;
  /** Mean PM2.5 / PM10 in µg/m³ over the snapshot window; absent when the station doesn't measure it. */
  pm25?: number;
  pm10?: number;
  /** Timestamp (local time, as published) of the newest hourly value used. */
  asOf?: string;
};

/** `windowHours` is set for live data: the mean covers only the newest N hourly values (a snapshot covers all, ~3 days). */
export type AirFile = { source: string; fetched: string; note: string; windowHours?: number; stations: AirStation[] };

export type AirIndicator = {
  /** Interpolated concentrations in µg/m³ (rounded to 0.1); absent when no station in reach measures it. */
  pm25?: number;
  pm10?: number;
  /** How many stations contributed, and the closest one. */
  stations: number;
  nearest: { name: string; distanceM: number };
  /** Date of the snapshot (YYYY-MM-DD). */
  asOf: string;
  /** Live data only: the mean covers the newest N hours, up to `latest` (newest reading used, local time as published). */
  windowHours?: number;
  latest?: string;
};

/** Stations further than this don't describe a cell; beyond it the cell has no air data (unknown ≠ clean). */
export const AIR_REACH_M = 6000;

/** PM2.5 / PM10 (µg/m³) at which the score is 100 and 0 — loosely the WHO 2021 annual guideline and "poor" EAQI. */
const SCALE = {
  pm25: { best: 5, worst: 50 },
  pm10: { best: 15, worst: 100 },
} as const;

type Pollutant = keyof typeof SCALE;

/** Inverse-distance-squared mean of the stations that measure `key` within reach; null if none. */
function idw(center: LngLat, stations: AirStation[], key: Pollutant): { value: number; used: number } | null {
  let sum = 0;
  let weight = 0;
  let used = 0;
  for (const s of stations) {
    const v = s[key];
    if (v === undefined) continue;
    const d = haversine(center, [s.lng, s.lat]);
    if (d > AIR_REACH_M) continue;
    const w = 1 / Math.max(d, 100) ** 2; // floor so a cell on top of a station doesn't divide by ~0
    sum += v * w;
    weight += w;
    used++;
  }
  return used === 0 ? null : { value: sum / weight, used };
}

export function interpolateAir(center: LngLat, file: AirFile): AirIndicator | null {
  const pm25 = idw(center, file.stations, "pm25");
  const pm10 = idw(center, file.stations, "pm10");
  if (!pm25 && !pm10) return null;
  let nearest: AirIndicator["nearest"] | null = null;
  let latest: string | undefined;
  const inReach = new Set<number>();
  for (const s of file.stations) {
    const d = haversine(center, [s.lng, s.lat]);
    if (d > AIR_REACH_M || (s.pm25 === undefined && s.pm10 === undefined)) continue;
    inReach.add(s.id);
    if (s.asOf && (!latest || s.asOf > latest)) latest = s.asOf;
    if (!nearest || d < nearest.distanceM) nearest = { name: s.name, distanceM: Math.round(d) };
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    ...(pm25 ? { pm25: r1(pm25.value) } : {}),
    ...(pm10 ? { pm10: r1(pm10.value) } : {}),
    stations: inReach.size,
    nearest: nearest as AirIndicator["nearest"],
    asOf: file.fetched,
    ...(file.windowHours ? { windowHours: file.windowHours, ...(latest ? { latest } : {}) } : {}),
  };
}

export const AIR_LEVELS = ["good", "normal", "bad", "very bad"] as const;
export type AirLevel = (typeof AIR_LEVELS)[number];

/** Upper bounds (µg/m³) of the first three levels, loosely following the European Air Quality Index bands. */
const LEVEL_BOUNDS = { pm10: [20, 40, 100], pm25: [10, 20, 50] } as const;

/** Plain-language level for quick reading; uses PM10 like the score, PM2.5 only when PM10 is missing. */
export function airLevel(air: AirIndicator): AirLevel {
  const key: Pollutant = air.pm10 !== undefined ? "pm10" : "pm25";
  const v = air[key] as number;
  const i = LEVEL_BOUNDS[key].findIndex((max) => v < max);
  return AIR_LEVELS[i === -1 ? AIR_LEVELS.length - 1 : i];
}

/**
 * 0–100, higher = cleaner. PM10 drives the score because far more stations report it than PM2.5 (in the committed
 * snapshot 5 vs 2), so the score is comparable across the whole city; PM2.5 is shown as extra context where known.
 */
export function airScore(air: AirIndicator): number {
  const key: Pollutant = air.pm10 !== undefined ? "pm10" : "pm25";
  const v = air[key] as number;
  const { best, worst } = SCALE[key];
  return Math.round(100 * Math.min(1, Math.max(0, (worst - v) / (worst - best))));
}
