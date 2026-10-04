// Builds data/health/features.json: pharmacies, doctors/clinics, hospitals, post offices and banks (OSM points).
// Usage: npx tsx scripts/health/build-features.ts
// Data © OpenStreetMap contributors, ODbL.
import { mkdirSync, writeFileSync } from "node:fs";
import { HEALTH_KINDS, type HealthKind } from "../../src/lib/data/health";

const BBOX = "49.95,19.75,50.15,20.15"; // same box as scripts/osm/fetch.ts
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const QUERIES: Record<HealthKind, string> = {
  pharmacy: `nwr["amenity"="pharmacy"](${BBOX});`,
  doctor: `nwr["amenity"~"^(doctors|clinic)$"](${BBOX});`,
  hospital: `nwr["amenity"="hospital"](${BBOX});`,
  post: `nwr["amenity"="post_office"](${BBOX});`,
  bank: `nwr["amenity"="bank"](${BBOX});`,
};

type El = { lat?: number; lon?: number; center?: { lat: number; lon: number } };

async function fetchKind(kind: HealthKind): Promise<El[]> {
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
  const kinds = [...HEALTH_KINDS];
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
  mkdirSync("data/health", { recursive: true });
  writeFileSync(
    "data/health/features.json",
    JSON.stringify({ source: "OpenStreetMap, © OpenStreetMap contributors, ODbL", fetched: new Date().toISOString().slice(0, 10), kinds, points }) + "\n",
  );
  console.log(`wrote data/health/features.json: ${points.length} points`);
}
main();
