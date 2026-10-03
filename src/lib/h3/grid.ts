import { cellToBoundary, polygonToCells } from "h3-js";
import { H3_RESOLUTION, KRAKOW_BBOX } from "./config";

/** All H3 cells covering the demo bounding box. */
export function getDemoCells(resolution = H3_RESOLUTION): string[] {
  const { south, north, west, east } = KRAKOW_BBOX;
  // h3-js v4 polygons are [lat, lng] by default.
  const ring: [number, number][] = [
    [south, west],
    [south, east],
    [north, east],
    [north, west],
    [south, west],
  ];
  return polygonToCells(ring, resolution);
}

/** Closed GeoJSON ring ([lng, lat]) for a cell. */
export function cellPolygon(h3Index: string): [number, number][] {
  const ring = cellToBoundary(h3Index, true) as [number, number][];
  return [...ring, ring[0]];
}
