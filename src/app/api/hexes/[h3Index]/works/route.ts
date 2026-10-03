import { loadWorks } from "@/lib/supabase/hex-scores";

// Construction / renovation works near one hexagon, each with its official source.
// Failure ⇒ empty list: the panel simply shows no works section.
export async function GET(_req: Request, ctx: RouteContext<"/api/hexes/[h3Index]/works">) {
  const { h3Index } = await ctx.params;
  const works = await loadWorks(h3Index);
  // A failed load answers 200 with an empty list; keep that out of caches so it is retried.
  if (!works) return Response.json({ works: [] }, { headers: { "Cache-Control": "no-store" } });
  // The works snapshot is refreshed daily, so a shorter lifetime than the other routes.
  return Response.json({ works }, { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" } });
}
