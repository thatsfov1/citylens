import { z } from "zod";
import { cellToLatLng } from "h3-js";
import { haversine } from "../data/geo";

// "Near a place": a place the user named (university, station, …) resolved to coordinates, plus a radius.
// Deterministic and client-side: hexes whose centre is farther than the radius are dimmed. No LLM involved
// beyond copying the name the user typed.

export const ANCHOR_RADII_M = [500, 1000, 1500, 2000] as const;
export const DEFAULT_ANCHOR_RADIUS_M = 1500;

export const anchorSchema = z.object({
  name: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(100).max(5000),
});

export type Anchor = z.infer<typeof anchorSchema>;

/** `?near=lat,lng,radiusM,name`; the name goes last because it is free text. */
export function anchorToQuery(a: Anchor): string {
  return `near=${[a.lat.toFixed(5), a.lng.toFixed(5), a.radiusM, encodeURIComponent(a.name)].join(",")}`;
}

export function anchorFromQuery(raw: string | string[] | undefined): Anchor | null {
  if (typeof raw !== "string") return null;
  const [lat, lng, radiusM, ...name] = raw.split(",");
  const parsed = anchorSchema.safeParse({
    lat: Number(lat),
    lng: Number(lng),
    radiusM: Number(radiusM),
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

/** Ids of hexes whose centre is farther than the anchor's radius. */
export function hexesOutsideAnchor(h3Indexes: readonly string[], anchor: Anchor): Set<string> {
  const out = new Set<string>();
  for (const id of h3Indexes) {
    const [lat, lng] = cellToLatLng(id);
    if (haversine([anchor.lng, anchor.lat], [lng, lat]) > anchor.radiusM) out.add(id);
  }
  return out;
}

export function formatRadius(m: number): string {
  return m < 1000 ? `${m} m` : `${m / 1000} km`;
}
