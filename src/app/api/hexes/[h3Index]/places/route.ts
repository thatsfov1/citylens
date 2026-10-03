import { loadPlaces } from "@/lib/supabase/hex-scores";

// Places (pins) and green outlines behind one hexagon's scores.
export async function GET(_req: Request, ctx: RouteContext<"/api/hexes/[h3Index]/places">) {
  const { h3Index } = await ctx.params;
  const result = await loadPlaces(h3Index);
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  // Only changes when the places are reloaded: let browsers/CDN reuse it for an hour (stale copy served while revalidating).
  return Response.json(result, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
