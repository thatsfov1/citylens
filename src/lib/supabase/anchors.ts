import { z } from "zod";
import { createClient } from "./server";
import { pickCandidate } from "../data/anchors";
import { geocodeInKrakow } from "../data/nominatim";
import type { Anchor } from "../scoring/anchor";

const row = z.object({ name: z.string(), kind: z.string(), lat: z.number(), lng: z.number() });

/**
 * Resolves a place name the user typed to coordinates: our own POI table first (offline-safe), then a bounded
 * Nominatim lookup for streets and addresses. Null when nothing matches.
 */
export async function resolveAnchor(query: string, radiusM: number): Promise<Anchor | null> {
  return (await resolveAnchorDebug(query, radiusM)).anchor;
}

export type AnchorResolution = { query: string; source: "pois" | "nominatim" | "none"; anchor: Anchor | null };

/** Same lookup as `resolveAnchor`, but also reports which source answered (for the debug view). */
export async function resolveAnchorDebug(query: string, radiusM: number): Promise<AnchorResolution> {
  const poi = await resolveFromPois(query, radiusM);
  if (poi) return { query, source: "pois", anchor: poi };
  const hit = await geocodeInKrakow(query);
  return hit
    ? { query, source: "nominatim", anchor: { name: hit.name, lat: hit.lat, lng: hit.lng, radiusM } }
    : { query, source: "none", anchor: null };
}

async function resolveFromPois(query: string, radiusM: number): Promise<Anchor | null> {
  try {
    // Escape LIKE wildcards: the query is user text.
    const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const supabase = await createClient();
    const { data, error } = await supabase.from("pois").select("name,kind,lat,lng").ilike("name", pattern).limit(50);
    if (error) throw error;
    const best = pickCandidate(query, z.array(row).parse(data));
    return best ? { name: best.name, lat: best.lat, lng: best.lng, radiusM } : null;
  } catch (err) {
    console.warn("anchor unresolved:", err);
    return null;
  }
}
