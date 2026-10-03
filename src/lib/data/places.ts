import { haversine, type LngLat } from "./geo";
import { CATEGORY_DISTANCE_SCALE, MAX_RADIUS_M } from "./score-hex";
import type { Place, PlaceCategory } from "../../types";

// Which places to show for one hexagon: the ones the score actually "saw", capped for readability.

export const PLACE_CATEGORIES = ["sport", "culture", "shopping", "transport"] as const satisfies readonly PlaceCategory[];

export const reachM = (c: PlaceCategory) => MAX_RADIUS_M * CATEGORY_DISTANCE_SCALE[c];
export const MAX_REACH_M = Math.max(...PLACE_CATEGORIES.map(reachM));

const CAP = 10;
const BUS_CAP = 6;
const TRANSPORT_OTHER_CAP = 8;

export type RawPoi = Omit<Place, "distanceM">;

/** Nearest places per category within that category's reach; rail/tram prioritised over buses. */
export function selectPlaces(center: LngLat, pois: RawPoi[]): Place[] {
  const withDist = pois
    .map((p) => ({ ...p, distanceM: Math.round(haversine(center, [p.lng, p.lat])) }))
    .filter((p) => p.distanceM <= reachM(p.category))
    .sort((a, b) => a.distanceM - b.distanceM);

  const out: Place[] = [];
  for (const c of PLACE_CATEGORIES) {
    const own = withDist.filter((p) => p.category === c);
    if (c === "transport") {
      // Capped per group (rail/tram vs bus), then merged back into one nearest-first list.
      out.push(
        ...[
          ...own.filter((p) => p.kind !== "bus_stop").slice(0, TRANSPORT_OTHER_CAP),
          ...own.filter((p) => p.kind === "bus_stop").slice(0, BUS_CAP),
        ].sort((a, b) => a.distanceM - b.distanceM),
      );
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
