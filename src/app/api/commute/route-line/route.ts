import { z } from "zod";
import { commuteRoute } from "@/lib/data/routing";
import { TRAVEL_MODES } from "@/lib/scoring/commute";

const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const bodySchema = z.object({ from: point, to: point, mode: z.enum(TRAVEL_MODES) });

// The path from one hexagon to the workplace, for drawing on the map.
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  return Response.json(await commuteRoute(body.data.from, body.data.to, body.data.mode));
}
