import { cellsToMultiPolygon } from "h3-js";

/** Match bands, weakest → strongest (quintiles of the percentile rank). */
export const BAND_COUNT = 5;

/** Muted red → orange → yellow → light green → green. */
export const BAND_COLORS = ["#d9695f", "#e49a5c", "#e8d26a", "#9bc77a", "#4ea36f"] as const;

/** Extra pseudo-band for hexes with nothing nearby in a category (shown neutral grey). */
export const NO_DATA_BAND = BAND_COUNT;
export const NO_DATA_COLOR = "#b8bec6";

export const BAND_LABELS = [
  "Weaker match",
  "Below-average match",
  "Average match",
  "Good match",
  "Strong match",
] as const;

export function bandOf(pct: number): number {
  return Math.min(BAND_COUNT - 1, Math.max(0, Math.floor(pct * BAND_COUNT)));
}

/**
 * One feature per band: adjacent cells of the same band are dissolved into a single
 * (multi)polygon, so no borders are drawn between them.
 */
export function bandZones(cells: string[], bands: number[]): GeoJSON.FeatureCollection {
  const byBand: string[][] = Array.from({ length: BAND_COUNT + 1 }, () => []);
  cells.forEach((cell, i) => byBand[bands[i]].push(cell));
  return {
    type: "FeatureCollection",
    features: byBand.flatMap((group, band) =>
      group.length === 0
        ? []
        : [
            {
              type: "Feature" as const,
              properties: { band },
              geometry: {
                type: "MultiPolygon" as const,
                coordinates: cellsToMultiPolygon(group, true),
              },
            },
          ],
    ),
  };
}
