import { z } from "zod";
import { isValidCell } from "h3-js";
import { createClient } from "./server";
import { getHexData } from "../mock-data/hexes";
import type { HexData, HexIndicators } from "../../types";

const score = z.number().min(0).max(100);
const rowSchema = z.object({
  h3_index: z.string(),
  sport_score: score,
  culture_score: score,
  greenery_score: score,
  shopping_score: score,
  transport_score: score,
  district: z.string().nullable(),
});

// Scores + district only: the heavy `indicators` JSON is fetched per hex on demand.
const LIST_COLUMNS = "h3_index,sport_score,culture_score,greenery_score,shopping_score,transport_score,district";

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
  raw: z.number(),
  within500: z.number(),
  within1000: z.number(),
  nearest: z.object({ name: z.string().nullable(), kind: z.string(), distanceM: z.number() }).nullable(),
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
