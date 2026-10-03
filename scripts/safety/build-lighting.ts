// Builds data/safety/lighting.json: midpoints of Kraków street segments that OSM tags as lit / unlit.
// Usage: npx tsx scripts/safety/build-lighting.ts
// Data © OpenStreetMap contributors, ODbL. Only segments with an explicit `lit` tag are kept: untagged ones
// say nothing (≈75% of ways), and service roads / tracks / steps are skipped (parking aisles, driveways).
import { mkdirSync, writeFileSync } from "node:fs";

const BBOX = "49.95,19.75,50.15,20.15"; // same box as scripts/osm/fetch.ts
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const QUERY = `[out:json][timeout:180];way["highway"~"^(residential|living_street|unclassified|tertiary|secondary|primary|trunk|footway|path|pedestrian|cycleway)$"]["lit"](${BBOX});out center tags qt;`;

const LIT_YES = new Set(["yes", "24/7", "automatic", "sunset-sunrise"]);

type Way = { center?: { lat: number; lon: number }; tags?: Record<string, string> };

async function fetchWays(): Promise<Way[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: QUERY }),
        headers: { "User-Agent": "winhackyeah-smart-city/0.1" },
        signal: AbortSignal.timeout(150_000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return ((await res.json()) as { elements: Way[] }).elements;
    } catch (e) {
      console.warn("failed on", url, String(e));
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("could not fetch lighting data");
}

async function main() {
  const ways = await fetchWays();
  // [lng, lat, lit(1) | unlit(0)] — compact on purpose, this file is committed.
  const points: [number, number, 0 | 1][] = [];
  for (const w of ways) {
    const lit = w.tags?.lit;
    if (!w.center || !lit) continue;
    if (LIT_YES.has(lit)) points.push([Math.round(w.center.lon * 1e5) / 1e5, Math.round(w.center.lat * 1e5) / 1e5, 1]);
    else if (lit === "no") points.push([Math.round(w.center.lon * 1e5) / 1e5, Math.round(w.center.lat * 1e5) / 1e5, 0]);
  }
  const litCount = points.filter((p) => p[2] === 1).length;
  mkdirSync("data/safety", { recursive: true });
  writeFileSync(
    "data/safety/lighting.json",
    JSON.stringify({ source: "OpenStreetMap (highway ways with a lit tag), © OpenStreetMap contributors, ODbL", fetched: new Date().toISOString().slice(0, 10), points }) + "\n",
  );
  console.log(`wrote data/safety/lighting.json: ${points.length} segments, ${litCount} lit (${Math.round((100 * litCount) / points.length)}%)`);
}
main();
