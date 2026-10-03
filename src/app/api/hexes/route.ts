import { loadHexData } from "@/lib/supabase/hex-scores";

// Stable frontend/backend boundary: returns HexData[] from Supabase,
// or the deterministic mock dataset if Supabase is unavailable.
export async function GET() {
  const hexes = await loadHexData();
  return Response.json(hexes);
}
