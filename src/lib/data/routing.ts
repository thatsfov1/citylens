import { z } from "zod";
import { cellToLatLng } from "h3-js";
import { estimateCommutes, estimateMinutes, type TravelMode } from "../scoring/commute";
import { haversine } from "./geo";

// Travel times to the workplace from the OSRM "table" service run by FOSSGIS on openstreetmap.de (OSM data,
// foot / bike / car). No public transit routing is available for free, so transit — and any failed chunk — falls
// back to the deterministic estimate in scoring/commute.ts. Best-effort: never throws.

const PROFILE: Partial<Record<TravelMode, string>> = { walk: "foot", bike: "bike", car: "car" };
const CHUNK = 100;
const PARALLEL = 3;
const ROUTE_MARGIN = 1.6;

const tableSchema = z.object({
  code: z.literal("Ok"),
  durations: z.array(z.array(z.number().nullable())),
});

/** Minutes per source from an OSRM table response (one destination = the workplace). Pure, so it is testable. */
export function parseTable(raw: unknown, expected: number): (number | null)[] | null {
  const parsed = tableSchema.safeParse(raw);
  if (!parsed.success || parsed.data.durations.length !== expected) return null;
  return parsed.data.durations.map((row) => (row[0] == null ? null : Math.max(0, Math.round(row[0] / 60))));
}

export type CommuteResult = { minutes: Record<string, number>; source: "routing" | "estimate" | "mixed" };

async function routeChunk(ids: string[], work: { lat: number; lng: number }, profile: string): Promise<(number | null)[] | null> {
  try {
    const coords = [...ids.map((id) => cellToLatLng(id)).map(([lat, lng]) => `${lng.toFixed(5)},${lat.toFixed(5)}`), `${work.lng.toFixed(5)},${work.lat.toFixed(5)}`];
    const sources = ids.map((_, i) => i).join(";");
    const url = `https://routing.openstreetmap.de/routed-${profile}/table/v1/driving/${coords.join(";")}?sources=${sources}&destinations=${ids.length}&annotations=duration`;
    const res = await fetch(url, { headers: { "User-Agent": "winhackyeah-smart-city/0.1" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return parseTable(await res.json(), ids.length);
  } catch {
    return null;
  }
}

/**
 * `maxMin`: cells whose estimate is far beyond the limit are clearly outside it, so they keep the estimate and are
 * not sent to the public routing server (all ~2,800 cells at once time it out).
 */
export async function commuteMinutes(
  allIds: string[],
  work: { lat: number; lng: number; mode: TravelMode },
  maxMin?: number,
): Promise<CommuteResult> {
  const estimateAll = estimateCommutes(allIds, work);
  const profile = PROFILE[work.mode];
  if (!profile) return { minutes: estimateAll, source: "estimate" };
  const ids = maxMin ? allIds.filter((id) => estimateAll[id] <= maxMin * ROUTE_MARGIN) : allIds;
  const estimate = estimateAll;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const minutes = { ...estimate };
  let routed = 0;
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const batch = chunks.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map((c) => routeChunk(c, work, profile)));
    results.forEach((r, k) => {
      if (!r) return;
      batch[k].forEach((id, j) => {
        const m = r[j];
        if (m != null) {
          minutes[id] = m;
          routed++;
        }
      });
    });
  }
  // Cells skipped as clearly out of reach keep the estimate and do not make a fully routed nearby area "mixed".
  const source = routed === 0 ? "estimate" : routed === ids.length ? "routing" : "mixed";
  return { minutes, source };
}

const routeSchema = z.object({
  code: z.literal("Ok"),
  routes: z.array(z.object({ duration: z.number(), distance: z.number(), geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()])) }) })).min(1),
});

export type RouteLine = { coordinates: [number, number][]; minutes: number; distanceM: number; source: "routing" | "straight" };

/** First route of an OSRM /route response, or null. Pure, so it is testable. */
export function parseRoute(raw: unknown): Omit<RouteLine, "source"> | null {
  const parsed = routeSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data.routes[0];
  return { coordinates: r.geometry.coordinates, minutes: Math.max(1, Math.round(r.duration / 60)), distanceM: Math.round(r.distance) };
}

/** Path from a hexagon centre to the workplace. Transit (and any failure) gives a straight line, flagged as such. */
export async function commuteRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode: TravelMode): Promise<RouteLine> {
  const profile = PROFILE[mode];
  if (profile) {
    try {
      const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${from.lng.toFixed(5)},${from.lat.toFixed(5)};${to.lng.toFixed(5)},${to.lat.toFixed(5)}?overview=full&geometries=geojson`;
      const res = await fetch(url, { headers: { "User-Agent": "winhackyeah-smart-city/0.1" }, signal: AbortSignal.timeout(8000) });
      const route = res.ok ? parseRoute(await res.json()) : null;
      if (route) return { ...route, source: "routing" };
    } catch {
      // fall through to the straight line
    }
  }
  const distanceM = haversine([from.lng, from.lat], [to.lng, to.lat]);
  return {
    coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
    minutes: estimateMinutes(distanceM, mode),
    distanceM: Math.round(distanceM),
    source: "straight",
  };
}
