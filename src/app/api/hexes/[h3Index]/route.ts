import { loadHexDetails } from "@/lib/supabase/hex-scores";

// District + OSM-derived indicators behind one hexagon's scores (for the details panel).
export async function GET(_req: Request, ctx: RouteContext<"/api/hexes/[h3Index]">) {
  const { h3Index } = await ctx.params;
  const details = await loadHexDetails(h3Index);
  if (!details) return Response.json({ error: "Not found" }, { status: 404 });
  // Only changes when the seed is reloaded: let browsers/CDN reuse it for an hour (stale copy served while revalidating).
  return Response.json(details, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
