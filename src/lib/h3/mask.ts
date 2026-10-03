import boundary from "./krakow-boundary.json";

/** Kraków's boundary as a GeoJSON line (for outlining the area of interest). */
export const boundaryFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: "Feature",
  properties: {},
  geometry: boundary as GeoJSON.Polygon,
};

/** The whole world with Kraków cut out — used to veil everything outside it. */
export const outsideMaskFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ],
      boundary.coordinates[0],
    ],
  },
};

/** Bounding box of Kraków as [[west, south], [east, north]]. */
export const KRAKOW_BOUNDS: [[number, number], [number, number]] = (() => {
  const ring = boundary.coordinates[0] as number[][];
  const lngs = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
})();
