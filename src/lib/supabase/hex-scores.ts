import { z } from "zod";
import { cellToLatLng, isValidCell } from "h3-js";
import { createClient } from "./server";
import { getHexData } from "../mock-data/hexes";
import { MAX_RADIUS_M } from "../data/score-hex";
import { bboxAround, selectPlaces } from "../data/places";
import type { LngLat } from "../data/geo";
import type { HexData, HexIndicators, PlacesResponse } from "../../types";

const score = z.number().min(0).max(100);
const rowSchema = z.object({
  h3_index: z.string(),
  sport_score: score,
  culture_score: score,
  greenery_score: score,
  shopping_score: score,
  transport_score: score,
  safety_score: score.nullable(),
  district: z.string().nullable(),
});

// Scores + district only: the heavy `indicators` JSON is fetched per hex on demand.
const LIST_COLUMNS = "h3_index,sport_score,culture_score,greenery_score,shopping_score,transport_score,safety_score,district";

export type HexSource = "supabase" | "mock";

/** Hex scores from Supabase; falls back to deterministic mock data if unavailable. */
export async function loadHexes(): Promise<{ hexes: HexData[]; source: HexSource }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("hex_scores").select(LIST_COLUMNS).limit(5000);
    if (error) throw error;
    const rows = z.array(rowSchema).parse(data);
    if (rows.length === 0) throw new Error("hex_scores is empty");
    return {
      source: "supabase",
      hexes: rows.map((r) => ({
        h3Index: r.h3_index,
        district: r.district,
        safety: r.safety_score,
        scores: {
          sport: r.sport_score,
          culture: r.culture_score,
          greenery: r.greenery_score,
          shopping: r.shopping_score,
          transport: r.transport_score,
        },
      })),
    };
  } catch (err) {
    console.warn("Supabase hex_scores unavailable, using mock data:", err);
    return { hexes: getHexData(), source: "mock" };
  }
}

export async function loadHexData(): Promise<HexData[]> {
  return (await loadHexes()).hexes;
}

const poiIndicator = z.object({
  radiusM: z.number().optional(),
  raw: z.number(),
  within500: z.number(),
  within1000: z.number(),
  nearest: z
    .object({ name: z.string().nullable(), kind: z.string(), distanceM: z.number(), departuresPerHour: z.number().optional() })
    .nullable(),
  departuresPerHourWithin500: z.number().optional(),
});
const indicatorsSchema = z.object({
  sport: poiIndicator,
  culture: poiIndicator,
  shopping: poiIndicator,
  transport: poiIndicator,
  greenery: z.object({
    raw: z.number(),
    coverShare: z.number(),
    nearestPark: z
      .object({ name: z.string().nullable(), kind: z.string(), distanceM: z.number(), areaHa: z.number() })
      .nullable(),
  }),
  safety: z
    .object({
      lighting: z.object({ segments: z.number(), lit: z.number(), litShare: z.number() }).optional(),
      crime: z
        .object({ area: z.string(), year: z.number(), per1000: z.number(), cityPer1000: z.number() })
        .optional(),
    })
    .optional(),
});

export type HexDetails = { h3Index: string; district: string | null; indicators: HexIndicators | null };

/** District and OSM-derived indicators for one cell; null if unknown or unavailable. */
export async function loadHexDetails(h3Index: string): Promise<HexDetails | null> {
  if (!isValidCell(h3Index)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("hex_scores")
      .select("h3_index,district,indicators")
      .eq("h3_index", h3Index)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const parsed = indicatorsSchema.safeParse(data.indicators);
    return { h3Index, district: data.district ?? null, indicators: parsed.success ? parsed.data : null };
  } catch (err) {
    console.warn("hex details unavailable:", err);
    return null;
  }
}

const poiRow = z.object({
  id: z.number(),
  category: z.enum(["sport", "culture", "shopping", "transport"]),
  kind: z.string(),
  name: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
});
const greenRow = z.object({ name: z.string().nullable(), area_ha: z.coerce.number(), geometry: z.any() });
const GREEN_LIMIT = 30;

/** Places (pins) and green-area outlines around one cell; null if unknown or unavailable. */
export async function loadPlaces(h3Index: string): Promise<PlacesResponse | null> {
  if (!isValidCell(h3Index)) return null;
  try {
    const [lat, lng] = cellToLatLng(h3Index);
    const center: LngLat = [lng, lat];
    const supabase = await createClient();

    const near = bboxAround(center, MAX_RADIUS_M);
    const [poisRes, greenRes] = await Promise.all([
      // Picked in the database (nearest per category): a bbox select is capped at 1000 rows by the API.
      supabase.rpc("nearest_pois", { p_lat: lat, p_lng: lng }),
      supabase
        .from("green_areas")
        .select("name,area_ha,geometry")
        .lte("min_lat", near.maxLat).gte("max_lat", near.minLat)
        .lte("min_lng", near.maxLng).gte("max_lng", near.minLng)
        .order("area_ha", { ascending: false })
        .limit(GREEN_LIMIT),
    ]);
    if (poisRes.error) throw poisRes.error;
    if (greenRes.error) throw greenRes.error;

    const places = selectPlaces(center, z.array(poiRow).parse(poisRes.data));
    const green: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: z.array(greenRow).parse(greenRes.data).map((g) => ({
        type: "Feature",
        properties: { name: g.name, areaHa: g.area_ha },
        geometry: g.geometry,
      })),
    };
    return { places, green };
  } catch (err) {
    console.warn("places unavailable:", err);
    return null;
  }
}
