import { z } from "zod";
import { createClient } from "./server";
import { getHexData } from "../mock-data/hexes";
import type { HexData } from "../../types";

const score = z.number().min(0).max(100);
const rowSchema = z.object({
  h3_index: z.string(),
  sport_score: score,
  culture_score: score,
  greenery_score: score,
  shopping_score: score,
  transport_score: score,
});

/** Hex scores from Supabase; falls back to deterministic mock data if unavailable. */
export async function loadHexData(): Promise<HexData[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("hex_scores").select("*").limit(5000);
    if (error) throw error;
    const rows = z.array(rowSchema).parse(data);
    if (rows.length === 0) throw new Error("hex_scores is empty");
    return rows.map((r) => ({
      h3Index: r.h3_index,
      scores: {
        sport: r.sport_score,
        culture: r.culture_score,
        greenery: r.greenery_score,
        shopping: r.shopping_score,
        transport: r.transport_score,
      },
    }));
  } catch (err) {
    console.warn("Supabase hex_scores unavailable, using mock data:", err);
    return getHexData();
  }
}
