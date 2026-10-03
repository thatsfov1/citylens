import { haversine, type LngLat } from "./geo";
import { EDUCATION_KIND_STAGES } from "./osm";
import { CATEGORY_DISTANCE_SCALE, EDUCATION_STAGE_SCALE, MAX_RADIUS_M } from "./score-hex";
import type { Place, PlaceCategory } from "../../types";

// Which places to show for one hexagon: the ones the score actually "saw", capped for readability.

export const PLACE_CATEGORIES = ["sport", "culture", "shopping", "transport", "education"] as const satisfies readonly PlaceCategory[];

export const reachM = (c: PlaceCategory) => MAX_RADIUS_M * CATEGORY_DISTANCE_SCALE[c];
/** Reach of one place: education kinds use their stage's own reach (kindergarten 1 km … university 2 km). */
export function placeReachM(p: { category: PlaceCategory; kind: string }): number {
  if (p.category !== "education") return reachM(p.category);
  const scales = (EDUCATION_KIND_STAGES[p.kind] ?? []).map((s) => EDUCATION_STAGE_SCALE[s]);
  return MAX_RADIUS_M * Math.max(...scales, 1);
}

export const MAX_REACH_M = Math.max(...PLACE_CATEGORIES.map(reachM));

const CAP = 10;
const BUS_CAP = 6;
const TRANSPORT_OTHER_CAP = 8;
const EDUCATION_KIND_CAP = 5;

export type RawPoi = Omit<Place, "distanceM">;

/** Nearest places per category within that category's reach; rail/tram prioritised over buses. */
export function selectPlaces(center: LngLat, pois: RawPoi[]): Place[] {
  const withDist = pois
    .map((p) => ({ ...p, distanceM: Math.round(haversine(center, [p.lng, p.lat])) }))
    .filter((p) => p.distanceM <= placeReachM(p))
    .sort((a, b) => a.distanceM - b.distanceM);

  const out: Place[] = [];
  for (const c of PLACE_CATEGORIES) {
    const own = withDist.filter((p) => p.category === c);
    if (c === "transport") {
      out.push(
        ...own.filter((p) => p.kind !== "bus_stop").slice(0, TRANSPORT_OTHER_CAP),
        ...own.filter((p) => p.kind === "bus_stop").slice(0, BUS_CAP),
      );
    } else if (c === "education") {
      // Per kind, so a dense centre still shows the university next to its 20 kindergartens.
      const kinds = [...new Set(own.map((p) => p.kind))];
      out.push(...kinds.flatMap((k) => own.filter((p) => p.kind === k).slice(0, EDUCATION_KIND_CAP)).sort((a, b) => a.distanceM - b.distanceM));
    } else {
      out.push(...own.slice(0, CAP));
    }
  }
  return out;
}

/** Lat/lng box (degrees) around a point, for the cheap DB prefilter. */
export function bboxAround([lng, lat]: LngLat, radiusM: number) {
  const dLat = radiusM / 110574;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}
