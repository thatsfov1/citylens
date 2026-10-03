import { assembleRings, ringBBox, type BBox, type LngLat, type Polygon, type Ring } from "./geo";
import type { Category } from "../../types";

// Parsing of raw Overpass JSON (data/osm/*.json) into typed features.

export type PoiCategory = Exclude<Category, "greenery">;

export type Poi = {
  category: PoiCategory;
  /** OSM tag value that qualified it (e.g. "museum", "tram_stop"). */
  kind: string;
  /** Relative importance, e.g. a railway station counts more than a bus stop. */
  weight: number;
  name: string | null;
  at: LngLat;
};

export type GreenArea = {
  name: string | null;
  polygons: Polygon[];
  bbox: BBox;
  areaM2: number;
};

export type District = { name: string; polygons: Polygon[]; bbox: BBox };

type Tags = Record<string, string>;
type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[];
};

const toRing = (g: { lat: number; lon: number }[]): Ring => g.map((p) => [p.lon, p.lat]);

const NOT_A_SHOP = new Set(["vacant", "no", "disused", "closed"]);

/** Maps OSM tags to a scoring category; null if irrelevant. Mirrors the tag lists in AGENTS.md §8. */
export function classifyPoi(tags: Tags): { category: PoiCategory; kind: string; weight: number } | null {
  const leisure = tags.leisure;
  if (leisure === "sports_centre" || leisure === "stadium") return { category: "sport", kind: leisure, weight: 1.5 };
  if (leisure === "fitness_centre" || leisure === "swimming_pool") return { category: "sport", kind: leisure, weight: 1 };
  if (leisure === "pitch") return { category: "sport", kind: leisure, weight: 0.5 };

  if (tags.tourism === "museum") return { category: "culture", kind: "museum", weight: 1.5 };
  if (tags.tourism === "gallery") return { category: "culture", kind: "gallery", weight: 1 };
  const h = tags.historic;
  if (h === "castle" || h === "monument" || h === "manor" || h === "fort") return { category: "culture", kind: `historic_${h}`, weight: 1 };
  const a = tags.amenity;
  if (a === "theatre" || a === "cinema" || a === "arts_centre") return { category: "culture", kind: a, weight: 1.5 };
  if (a === "library") return { category: "culture", kind: a, weight: 1 };
  if (a === "community_centre") return { category: "culture", kind: a, weight: 0.7 };

  const shop = tags.shop;
  // Empty or disused units are not shops anyone can use.
  if (shop && !NOT_A_SHOP.has(shop)) {
    if (shop === "mall" || shop === "department_store") return { category: "shopping", kind: shop, weight: 4 };
    if (shop === "supermarket") return { category: "shopping", kind: shop, weight: 2 };
    return { category: "shopping", kind: shop, weight: 0.7 };
  }

  if (tags.railway === "station" || tags.railway === "halt") return { category: "transport", kind: "rail_station", weight: 5 };
  if (tags.railway === "tram_stop") return { category: "transport", kind: "tram_stop", weight: 2 };
  if (tags.highway === "bus_stop") return { category: "transport", kind: "bus_stop", weight: 1 };
  return null;
}

export function parsePois(elements: OsmElement[]): Poi[] {
  const out: Poi[] = [];
  for (const el of elements) {
    const c = classifyPoi(el.tags ?? {});
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!c || lat === undefined || lon === undefined) continue;
    out.push({ ...c, name: el.tags?.name ?? null, at: [lon, lat] });
  }
  return out;
}

/** Polygon area in m² (equirectangular approximation; fine at city scale). */
export function ringAreaM2(ring: Ring): number {
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0);
  const ky = 110574;
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] * kx) * (ring[i][1] * ky) - (ring[i][0] * kx) * (ring[j][1] * ky);
  }
  return Math.abs(s) / 2;
}

/** Splits assembled rings into outer polygons, attaching inner rings as holes. */
function ringsToPolygons(outers: Ring[], inners: Ring[]): Polygon[] {
  return outers.map((o) => {
    const holes = inners.filter((h) => h.length && ringBBox(h)[0] >= ringBBox(o)[0] && ringBBox(h)[2] <= ringBBox(o)[2]);
    return [o, ...holes];
  });
}

function elementPolygons(el: OsmElement): Polygon[] {
  if (el.type === "way" && el.geometry) {
    const ring = toRing(el.geometry);
    const closed = ring.length >= 4 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1];
    return closed ? [[ring]] : [];
  }
  if (el.type === "relation" && el.members) {
    const seg = (role: string) =>
      el.members!.filter((m) => m.type === "way" && m.geometry && (m.role === role || (role === "outer" && m.role === ""))).map((m) => toRing(m.geometry!));
    return ringsToPolygons(assembleRings(seg("outer")), assembleRings(seg("inner")));
  }
  return [];
}

function polygonsArea(polys: Polygon[]): number {
  return polys.reduce((sum, [outer, ...holes]) => sum + ringAreaM2(outer) - holes.reduce((a, h) => a + ringAreaM2(h), 0), 0);
}

function polygonsBBox(polys: Polygon[]): BBox {
  const boxes = polys.map((p) => ringBBox(p[0]));
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
}

export function parseGreen(elements: OsmElement[]): GreenArea[] {
  const out: GreenArea[] = [];
  for (const el of elements) {
    const polygons = elementPolygons(el);
    if (!polygons.length) continue;
    out.push({ name: el.tags?.name ?? null, polygons, bbox: polygonsBBox(polygons), areaM2: polygonsArea(polygons) });
  }
  return out;
}

export function parseDistricts(elements: OsmElement[]): District[] {
  const out: District[] = [];
  for (const el of elements) {
    const polygons = elementPolygons(el);
    const name = el.tags?.name;
    if (!polygons.length || !name) continue;
    out.push({ name, polygons, bbox: polygonsBBox(polygons) });
  }
  return out;
}
