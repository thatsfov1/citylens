import { z } from "zod";
import { resolveAnchor } from "@/lib/supabase/anchors";

const bodySchema = z.object({ query: z.string().trim().min(2).max(120) });

// Resolves a workplace address / place name typed by the user to coordinates (our POIs first, then Nominatim).
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const hit = await resolveAnchor(body.data.query, 1000);
  if (!hit) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ name: hit.name, lat: hit.lat, lng: hit.lng });
}
