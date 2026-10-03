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
