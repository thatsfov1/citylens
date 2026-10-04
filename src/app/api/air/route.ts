import snapshot from "../../../../data/air/stations.json";
import type { AirFile } from "@/lib/data/air";
import { airCells, newestReading, type LiveAirResponse } from "@/lib/data/air-live";
import { fetchGiosStations } from "@/lib/data/gios";
import { getDemoCells } from "@/lib/h3/grid";

// Live air quality for every hexagon: fresh GIOŚ readings (mean of the newest 24 hours) interpolated like the stored
// snapshot. If GIOŚ is slow or down, the committed snapshot is served instead and says so (source: "snapshot"):
// the demo never depends on a live service (AGENTS.md §16). GIOŚ publishes hourly, so results are kept for 30 min.

const TTL_MS = 30 * 60 * 1000;
let cached: { at: number; body: LiveAirResponse } | null = null;
let inflight: Promise<LiveAirResponse> | null = null;

async function build(): Promise<LiveAirResponse> {
  const cells = getDemoCells();
  try {
    const file = await fetchGiosStations({ windowHours: 24, minHours: 18, attempts: 1, timeoutMs: 6_000 });
    if (file.stations.length > 0) {
      return { source: "live", latest: newestReading(file), cells: airCells(file, cells) };
    }
  } catch {
    // fall through to the snapshot
  }
  const file = snapshot as AirFile;
  return { source: "snapshot", latest: newestReading(file), cells: airCells(file, cells) };
}

export async function GET() {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    inflight ??= build().finally(() => (inflight = null));
    const body = await inflight;
    // A snapshot answer is retried sooner than a live one.
    cached = { at: body.source === "live" ? Date.now() : Date.now() - TTL_MS + 2 * 60 * 1000, body };
  }
  return Response.json(cached.body, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=1800" },
  });
}
