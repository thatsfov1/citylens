import { z } from "zod";
import { commuteRoute, type RouteLine } from "@/lib/data/routing";
import { haversine } from "@/lib/data/geo";
import { planPath, planTransit, type Timetable } from "@/lib/data/transit";
import { TRAVEL_MODES } from "@/lib/scoring/commute";

const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const bodySchema = z.object({ from: point, to: point, mode: z.enum(TRAVEL_MODES) });

/** A typical weekday morning commute, in seconds after midnight (the timetable covers 06:30–10:30 departures). */
const DEPART_AT = 8 * 3600;

async function transitRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<RouteLine | null> {
  try {
    const timetable = (await import("../../../../../data/gtfs/timetable.json")).default as unknown as Timetable;
    const plan = planTransit(timetable, from, to, DEPART_AT);
    if (!plan) return null;
    return {
      coordinates: planPath(plan, from, to),
      minutes: plan.totalMinutes,
      distanceM: Math.round(haversine([from.lng, from.lat], [to.lng, to.lat])),
      source: "gtfs",
      transit: plan,
    };
  } catch {
    return null; // no timetable or a planner error: fall back to the estimate
  }
}

// The path from one hexagon to the workplace, for drawing on the map. Transit uses the ZTP Kraków timetable.
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { from, to, mode } = body.data;
  if (mode === "transit") {
    const route = await transitRoute(from, to);
    if (route) return Response.json(route);
  }
  return Response.json(await commuteRoute(from, to, mode));
}
