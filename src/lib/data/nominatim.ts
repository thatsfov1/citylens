import { z } from "zod";

// Fallback geocoder for places that are not in `pois` (streets, addresses). Live and best-effort: any failure
// means "no anchor", never an error. Bounded to the Kraków area; one request per lookup (usage policy: ≤ 1/s).
// Data © OpenStreetMap contributors, ODbL.

const VIEWBOX = "19.75,50.15,20.15,49.95"; // left,top,right,bottom — same box as scripts/osm/fetch.ts

const result = z.object({
  name: z.string().optional(),
  display_name: z.string(),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
});

export type GeocodeHit = { name: string; lat: number; lng: number };

/** First usable hit from a Nominatim JSON response, or null. Pure, so it is testable. */
export function parseNominatim(raw: unknown): GeocodeHit | null {
  const parsed = z.array(result).safeParse(raw);
  const hit = parsed.success ? parsed.data[0] : undefined;
  if (!hit) return null;
  return { name: hit.name || hit.display_name.split(",")[0], lat: hit.lat, lng: hit.lon };
}

export async function geocodeInKrakow(query: string): Promise<GeocodeHit | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({
      q: `${query}, Kraków`,
      format: "jsonv2",
      limit: "1",
      countrycodes: "pl",
      viewbox: VIEWBOX,
      bounded: "1",
    }).toString();
    const res = await fetch(url, {
      headers: { "User-Agent": "winhackyeah-smart-city/0.1" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return parseNominatim(await res.json());
  } catch {
    return null;
  }
}
