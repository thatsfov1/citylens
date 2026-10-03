import { cellToLatLng, cellsToMultiPolygon } from "h3-js";

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

/** Dissolved outline of the cells whose percentile rank is at least `threshold`. */
export function topZone(cells: string[], pcts: number[], threshold = 0.9): GeoJSON.FeatureCollection {
  const top = cells.filter((_, i) => pcts[i] >= threshold);
  return {
    type: "FeatureCollection",
    features:
      top.length === 0
        ? []
        : [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "MultiPolygon", coordinates: cellsToMultiPolygon(top, true) },
            },
          ],
  };
}

/**
 * District overlay built from the per-hex `district` names: one dissolved outline per district
 * (follows hex edges) and one label point, placed on the member cell nearest the district's centre.
 */
export function districtLayers(
  hexes: { h3Index: string; district?: string | null }[],
): { outlines: GeoJSON.FeatureCollection; labels: GeoJSON.FeatureCollection } {
  const byDistrict = new Map<string, string[]>();
  for (const { h3Index, district } of hexes) {
    if (!district) continue;
    const cells = byDistrict.get(district);
    if (cells) cells.push(h3Index);
    else byDistrict.set(district, [h3Index]);
  }
  const outlines: GeoJSON.Feature[] = [];
  const labels: GeoJSON.Feature[] = [];
  for (const [name, cells] of byDistrict) {
    outlines.push({
      type: "Feature",
      properties: { name },
      geometry: { type: "MultiPolygon", coordinates: cellsToMultiPolygon(cells, true) },
    });
    const centers = cells.map((c) => cellToLatLng(c));
    const meanLat = centers.reduce((a, [lat]) => a + lat, 0) / centers.length;
    const meanLng = centers.reduce((a, [, lng]) => a + lng, 0) / centers.length;
    let best = centers[0];
    let bestD = Infinity;
    for (const c of centers) {
      const d = (c[0] - meanLat) ** 2 + (c[1] - meanLng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    labels.push({
      type: "Feature",
      properties: { name },
      geometry: { type: "Point", coordinates: [best[1], best[0]] },
    });
  }
  return {
    outlines: { type: "FeatureCollection", features: outlines },
    labels: { type: "FeatureCollection", features: labels },
  };
}
