import { z } from "zod";
import { isValidCell } from "h3-js";
import { commuteMinutes } from "@/lib/data/routing";
import { TRAVEL_MODES } from "@/lib/scoring/commute";

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  mode: z.enum(TRAVEL_MODES),
  maxMin: z.number().int().min(5).max(120).optional(),
  cells: z.array(z.string()).min(1).max(4000),
});

// Travel minutes from every given hexagon to the workplace. The client sends the cell ids it already has.
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success || !body.data.cells.every(isValidCell)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  return Response.json(await commuteMinutes(body.data.cells, body.data, body.data.maxMin));
}
