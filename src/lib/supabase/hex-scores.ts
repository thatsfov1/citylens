import { z } from "zod";
import { cellToLatLng, isValidCell } from "h3-js";
import { createClient } from "./server";
import { getHexData } from "../mock-data/hexes";
import { MAX_RADIUS_M } from "../data/score-hex";
import { bboxAround, selectPlaces } from "../data/places";
import { WORKS_RADIUS_M } from "../data/works";
import type { LngLat } from "../data/geo";
import type { HexData, HexIndicators, PlacesResponse, WorkNearby } from "../../types";

const score = z.number().min(0).max(100);
const rowSchema = z.object({
  h3_index: z.string(),
  sport_score: score,
  culture_score: score,
  greenery_score: score,
  shopping_score: score,
  transport_score: score,
  education_score: score,
  education_stages: z.object({ kindergarten: score, primary: score, secondary: score, university: score }).nullable(),
  safety_score: score.nullable(),
  air_score: score.nullable(),
  district: z.string().nullable(),
});

// Scores + district only: the heavy `indicators` JSON is fetched per hex on demand.
const LIST_COLUMNS = "h3_index,sport_score,culture_score,greenery_score,shopping_score,transport_score,education_score,education_stages,safety_score,air_score,district";

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
        air: r.air_score,
        educationStages: r.education_stages ?? undefined,
        scores: {
          sport: r.sport_score,
          culture: r.culture_score,
          greenery: r.greenery_score,
          shopping: r.shopping_score,
          transport: r.transport_score,
          education: r.education_score,
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
  // Optional: rows scored before education existed have no such key.
  education: poiIndicator.extend({ stages: z.object({ kindergarten: poiIndicator, primary: poiIndicator, secondary: poiIndicator, university: poiIndicator }) }).optional(),
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
      cctv: z.object({ cameras: z.number() }).optional(),
      emergency: z
        .object({ police: z.number().nullable(), fire: z.number().nullable(), hospital: z.number().nullable() })
        .optional(),
      nightlife: z.object({ venues: z.number() }).optional(),
      parts: z.record(z.string(), z.number()).optional(),
      crime: z
        .object({ area: z.string(), year: z.number(), per1000: z.number(), cityPer1000: z.number() })
        .optional(),
    })
    .optional(),
  air: z
    .object({
      pm25: z.number().optional(),
      pm10: z.number().optional(),
      stations: z.number(),
      nearest: z.object({ name: z.string(), distanceM: z.number() }),
      asOf: z.string(),
      windowHours: z.number().optional(),
      latest: z.string().optional(),
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
  category: z.enum(["sport", "culture", "shopping", "transport", "education"]),
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

const workRow = z.object({
  id: z.number(),
  title: z.string(),
  kind: z.enum(["road", "tram", "rail", "building", "green", "utility", "other"]),
  status: z.enum(["ongoing", "planned", "decision"]),
  date_from: z.string().nullable(),
  date_to: z.string().nullable(),
  when_label: z.string().nullable(),
  source_name: z.string(),
  source_url: z.string(),
  published_at: z.string().nullable(),
  distance_m: z.number(),
});

/** Works (ongoing / planned / permits) within ~1 km of the cell centre; null if unknown or unavailable. */
export async function loadWorks(h3Index: string): Promise<WorkNearby[] | null> {
  if (!isValidCell(h3Index)) return null;
  try {
    const [lat, lng] = cellToLatLng(h3Index);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("works_near", { p_lat: lat, p_lng: lng, p_radius_m: WORKS_RADIUS_M });
    if (error) throw error;
    return z.array(workRow).parse(data).map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      status: r.status,
      dateFrom: r.date_from,
      dateTo: r.date_to,
      whenLabel: r.when_label,
      sourceName: r.source_name,
      sourceUrl: r.source_url,
      publishedAt: r.published_at,
      distanceM: Math.round(r.distance_m),
    }));
  } catch (err) {
    console.warn("works unavailable:", err);
    return null;
  }
}
