import { loadWorksMap } from "@/lib/data/works-map";

// All official works / plans / permits as GeoJSON for the timeline layer. Static data (rebuilt by
// scripts/works/build.ts), so it works even when the database is down.
export async function GET() {
  try {
    return Response.json(loadWorksMap(), { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" } });
  } catch (err) {
    console.warn("works map unavailable:", err);
    return Response.json({ type: "FeatureCollection", features: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
