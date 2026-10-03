import { z } from "zod";
import { cellToLatLng } from "h3-js";
import { haversine } from "../data/geo";

// Workplace + commute: a fixed anchor and a travel-time limit. Like "near a place" and rent it is a FILTER, never
// a score term: a hex that matches the user well but is too far from work is dimmed, the weights stay untouched.
// Minutes come from the data layer (routing, or the estimate below); the LLM never produces them.

export const TRAVEL_MODES = ["walk", "bike", "transit", "car"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const MODE_LABELS: Record<TravelMode, string> = {
  walk: "pieszo",
  bike: "rowerem",
  transit: "komunikacją miejską",
  car: "samochodem",
};

export const COMMUTE_LIMITS_MIN = [15, 30, 45, 60] as const;
export const DEFAULT_COMMUTE_MIN = 30;

export const workplaceSchema = z.object({
  name: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  mode: z.enum(TRAVEL_MODES),
  maxMin: z.number().int().min(5).max(120),
});

export type Workplace = z.infer<typeof workplaceSchema>;

/** `?work=lat,lng,mode,maxMin,name`; the name goes last because it is free text. */
export function workplaceToQuery(w: Workplace): string {
  return `work=${[w.lat.toFixed(5), w.lng.toFixed(5), w.mode, w.maxMin, encodeURIComponent(w.name)].join(",")}`;
}

export function workplaceFromQuery(raw: string | string[] | undefined): Workplace | null {
  if (typeof raw !== "string") return null;
  const [lat, lng, mode, maxMin, ...name] = raw.split(",");
  const parsed = workplaceSchema.safeParse({
    lat: Number(lat),
    lng: Number(lng),
    mode,
    maxMin: Number(maxMin),
    name: safeDecode(name.join(",")),
  });
  return parsed.success ? parsed.data : null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Fallback when routing is unavailable: straight-line distance × detour factor ÷ typical speed (+ a fixed wait for
 * public transport). Deliberately rough; the UI labels it "approx.".
 */
const ESTIMATE: Record<TravelMode, { kmh: number; detour: number; fixedMin: number }> = {
  walk: { kmh: 4.8, detour: 1.3, fixedMin: 0 },
  bike: { kmh: 14, detour: 1.3, fixedMin: 0 },
  transit: { kmh: 17, detour: 1.35, fixedMin: 8 },
  car: { kmh: 28, detour: 1.35, fixedMin: 3 },
};

export function estimateMinutes(distanceM: number, mode: TravelMode): number {
  const e = ESTIMATE[mode];
  return Math.round(e.fixedMin + ((distanceM * e.detour) / 1000 / e.kmh) * 60);
}

export function estimateCommutes(h3Indexes: readonly string[], work: Pick<Workplace, "lat" | "lng" | "mode">): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of h3Indexes) {
    const [lat, lng] = cellToLatLng(id);
    out[id] = estimateMinutes(haversine([lng, lat], [work.lng, work.lat]), work.mode);
  }
  return out;
}

/**
 * What the commute filter does to the map. If at least one area is within the limit, the others are dimmed.
 * If none is, nothing is dimmed (an empty map helps nobody) and `nearest` is the closest option to name as a trade-off.
 */
export type CommuteFit = {
  /** Hexes beyond the limit to dim; empty when no area is within the limit. */
  outside: Set<string>;
  within: number;
  /** Fastest commute among all hexes, in minutes (null with no data). */
  nearestMin: number | null;
};

export function classifyCommute(minutes: Record<string, number>, maxMin: number): CommuteFit {
  const ids = Object.keys(minutes);
  const outside = new Set(ids.filter((id) => minutes[id] > maxMin));
  const within = ids.length - outside.size;
  const nearestMin = ids.length ? Math.min(...ids.map((id) => minutes[id])) : null;
  return { outside: within > 0 ? outside : new Set(), within, nearestMin };
}

export const formatMinutes = (m: number) => (m < 1 ? "<1 min" : `${Math.round(m)} min`);
