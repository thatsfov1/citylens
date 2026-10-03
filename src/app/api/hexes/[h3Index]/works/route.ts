import { loadWorks } from "@/lib/supabase/hex-scores";

// Construction / renovation works near one hexagon, each with its official source.
// Failure ⇒ empty list: the panel simply shows no works section.
export async function GET(_req: Request, ctx: RouteContext<"/api/hexes/[h3Index]/works">) {
  const { h3Index } = await ctx.params;
  const works = await loadWorks(h3Index);
  return Response.json({ works: works ?? [] });
}
