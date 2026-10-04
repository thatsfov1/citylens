import { cellToLatLng } from "h3-js";
import { airScore, interpolateAir, type AirFile, type AirIndicator } from "./air";

// Live air: the same interpolation as the stored snapshot, run on fresh GIOŚ readings. Deterministic given the
// readings; nothing here is estimated beyond what air.ts already does.

export type LiveAirCell = { score: number; air: AirIndicator };

export type LiveAirResponse = {
  /** "live" = fresh readings from GIOŚ; "snapshot" = the committed file (API unreachable), same numbers as the database. */
  source: "live" | "snapshot";
  /** Newest hourly reading used (local time, as published), when known. */
  latest: string | null;
  cells: Record<string, LiveAirCell>;
};

/** Air score and indicator for every cell that has a station in reach. */
export function airCells(file: AirFile, h3Indexes: readonly string[]): Record<string, LiveAirCell> {
  const out: Record<string, LiveAirCell> = {};
  for (const h3 of h3Indexes) {
    const [lat, lng] = cellToLatLng(h3);
    const air = interpolateAir([lng, lat], file);
    if (air) out[h3] = { score: airScore(air), air };
  }
  return out;
}

export function newestReading(file: AirFile): string | null {
  return file.stations.reduce<string | null>((m, s) => (s.asOf && (!m || s.asOf > m) ? s.asOf : m), null);
}

/** Replaces the stored air score with the live one where there is one; every other cell is left as it was. */
export function applyLiveAir<T extends { h3Index: string; air?: number | null }>(
  hexes: T[],
  live: LiveAirResponse | null,
): T[] {
  if (!live || live.source !== "live") return hexes;
  return hexes.map((h) => {
    const c = live.cells[h.h3Index];
    return c ? { ...h, air: c.score } : h;
  });
}
