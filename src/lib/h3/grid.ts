import { cellToBoundary, polygonToCells } from "h3-js";
import { H3_RESOLUTION } from "./config";
import boundary from "./krakow-boundary.json";

/**
 * H3 cells whose centre lies inside Kraków's administrative boundary
 * (OpenStreetMap data © OpenStreetMap contributors, ODbL — simplified, static).
 */
export function getDemoCells(resolution = H3_RESOLUTION): string[] {
  // GeoJSON ring, [lng, lat].
  return polygonToCells(boundary.coordinates as number[][][], resolution, true);
}

/** Closed GeoJSON ring ([lng, lat]) for a cell. */
export function cellPolygon(h3Index: string): [number, number][] {
  const ring = cellToBoundary(h3Index, true) as [number, number][];
  return [...ring, ring[0]];
}
