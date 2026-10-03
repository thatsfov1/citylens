// Builds data/safety/features.json: points of OSM features that describe the safety environment of a street.
// Usage: npx tsx scripts/safety/build-features.ts
// Data © OpenStreetMap contributors, ODbL.
import { mkdirSync, writeFileSync } from "node:fs";
import { SAFETY_FEATURE_KINDS, type SafetyFeatureKind } from "../../src/lib/data/safety";

const BBOX = "49.95,19.75,50.15,20.15"; // same box as scripts/osm/fetch.ts
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const QUERIES: Record<SafetyFeatureKind, string> = {
  police: `nwr["amenity"="police"](${BBOX});`,
  fire_station: `nwr["amenity"="fire_station"](${BBOX});`,
  hospital: `nwr["amenity"~"^(hospital|clinic)$"](${BBOX});`,
  cctv: `nwr["man_made"="surveillance"](${BBOX});`,
  nightlife: `nwr["amenity"~"^(bar|pub|nightclub)$"](${BBOX});`,
};

type El = { lat?: number; lon?: number; center?: { lat: number; lon: number } };

async function fetchKind(kind: SafetyFeatureKind): Promise<El[]> {
  const query = `[out:json][timeout:120];(${QUERIES[kind]});out center qt;`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: { "User-Agent": "winhackyeah-smart-city/0.1" },
        signal: AbortSignal.timeout(150_000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return ((await res.json()) as { elements: El[] }).elements;
    } catch (e) {
      console.warn(kind, "failed on", url, String(e));
      // Overpass answers 429 when called too often: back off for longer each time.
      await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
    }
  }
  throw new Error(`could not fetch ${kind}`);
}

async function main() {
  const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
  // [lng, lat, kind index into `kinds`] — compact on purpose, this file is committed.
  const kinds = [...SAFETY_FEATURE_KINDS];
  const points: [number, number, number][] = [];
  for (const [i, kind] of kinds.entries()) {
    const els = await fetchKind(kind);
    let n = 0;
    for (const e of els) {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (lat === undefined || lon === undefined) continue;
      points.push([r5(lon), r5(lat), i]);
      n++;
    }
    console.log(kind, n);
    await new Promise((r) => setTimeout(r, 8000)); // be gentle with the public mirrors
  }
  mkdirSync("data/safety", { recursive: true });
  writeFileSync(
    "data/safety/features.json",
    JSON.stringify({ source: "OpenStreetMap, © OpenStreetMap contributors, ODbL", fetched: new Date().toISOString().slice(0, 10), kinds, points }) + "\n",
  );
  console.log(`wrote data/safety/features.json: ${points.length} points`);
}
main();
