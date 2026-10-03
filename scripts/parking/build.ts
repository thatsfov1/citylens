// Builds the parking snapshot used by the "I have a car" card. Information only, never part of the scores.
//   npx tsx scripts/parking/build.ts            fetch both sources, then build
//   FETCH=0 npx tsx scripts/parking/build.ts    rebuild from data/parking/*.json without any network
// Sources: OpenStreetMap car parks (Overpass, ODbL) and the city GIS (MSIP) parking meters layer.
// Raw files are committed, so a failed fetch keeps the previous raw file and the build still succeeds.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { CarParkRow, MeterRow, ParkingAccess, ParkingData, ParkingKind, ParkRideRow, StreetRow } from "../../src/lib/scoring/parking";

const RAW_DIR = "data/parking";
const OSM_FILE = `${RAW_DIR}/osm-parking.json`;
const MSIP_FILE = `${RAW_DIR}/msip-meters.json`;
const OUT_FILE = "src/lib/data/parking-data.json";
const BBOX = "49.95,19.75,50.15,20.15"; // s,w,n,e: the city with a margin, like scripts/osm/fetch.ts
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const MSIP_LAYER = "https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/K04_PARKOMETRY/MapServer/0";
const METERS_AS_OF = "2019-05"; // the service description says "stan na V 2019r."

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
type Raw<T> = { retrieved: string; items: T[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const readRaw = <T>(file: string): Raw<T> | null => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Raw<T>) : null);

async function fetchOsm(): Promise<Raw<OsmElement> | null> {
  const query = `[out:json][timeout:180];(nwr["amenity"="parking"](${BBOX}););out center tags;`;
  for (let round = 0; round < 3; round++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body: new URLSearchParams({ data: query }),
          headers: { "User-Agent": "winhackyeah-smart-city/0.1" },
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { elements: OsmElement[] };
        if (!Array.isArray(json.elements) || json.elements.length === 0) throw new Error("empty answer");
        console.log(`OSM: ${json.elements.length} elements from ${url}`);
        return { retrieved: today(), items: json.elements };
      } catch (e) {
        console.warn("OSM failed on", url, String(e));
      }
    }
    await sleep(8000 * (round + 1));
  }
  return null;
}

async function fetchMeters(): Promise<Raw<MeterRow> | null> {
  try {
    const items: MeterRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const url = `${MSIP_LAYER}/query?where=1%3D1&outFields=objectid&outSR=4326&f=geojson&resultOffset=${offset}&resultRecordCount=1000`;
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { features?: { geometry?: { coordinates?: number[] } }[] };
      const page = (json.features ?? []).flatMap((f) => {
        const c = f.geometry?.coordinates;
        return c && c.length >= 2 ? [[Math.round(c[1] * 1e5) / 1e5, Math.round(c[0] * 1e5) / 1e5] as MeterRow] : [];
      });
      items.push(...page);
      if (page.length < 1000) break;
    }
    if (items.length === 0) throw new Error("no meters");
    console.log(`MSIP: ${items.length} parking meters`);
    return { retrieved: today(), items };
  } catch (e) {
    console.warn("MSIP failed:", String(e));
    return null;
  }
}

const KIND: Record<string, ParkingKind> = {
  surface: "surface",
  "multi-storey": "garage",
  underground: "garage",
  rooftop: "garage",
};
/** Parking along the kerb is mapped as many short segments; those are pooled instead of listed one by one. */
const STREET = new Set(["street_side", "lane", "on_kerb", "half_on_kerb", "shoulder", "layby"]);

function access(tags: Record<string, string>): ParkingAccess {
  const a = tags.access;
  if (!a || a === "yes" || a === "permissive" || a === "public") return "public";
  if (a === "customers") return "customers";
  if (a === "permit" || a === "residents") return "permit";
  return "private"; // private, no, delivery, ...
}

function convert(elements: OsmElement[]): { carParks: CarParkRow[]; streets: StreetRow[]; parkRide: ParkRideRow[] } {
  const carParks: CarParkRow[] = [];
  const cells = new Map<string, StreetRow>();
  const parkRide: ParkRideRow[] = [];
  for (const e of elements) {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const tags = e.tags ?? {};
    if (lat === undefined || lon === undefined || tags.amenity !== "parking") continue;
    // Bicycle, motorcycle-only and other non-car parking is not for this card.
    if (tags.parking === "bicycle" || tags.bicycle_parking || (tags.motorcar === "no" && tags.motorcycle === "yes")) continue;
    const [la, lo] = [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5];
    if (STREET.has(tags.parking ?? "")) {
      // Pooled on a 0.001 degree grid (about 110 m by 70 m), counted at the cell centre.
      const [cla, clo] = [Math.round(lat * 1e3) / 1e3, Math.round(lon * 1e3) / 1e3];
      const row = cells.get(`${cla},${clo}`) ?? [cla, clo, 0, 0, 0];
      row[2]++;
      if (tags.fee === "yes" || (tags.fee && tags.fee !== "no")) row[3]++;
      else if (tags.fee === "no") row[4]++;
      cells.set(`${cla},${clo}`, row);
      continue;
    }
    if (tags.park_ride && tags.park_ride !== "no") parkRide.push([la, lo, tags.name ?? tags.operator ?? "Park & ride"]);
    const fee = tags.fee === "yes" ? 1 : tags.fee === "no" ? 0 : -1;
    const capacity = Number.parseInt(tags.capacity ?? "", 10);
    carParks.push([la, lo, KIND[tags.parking ?? ""] ?? "other", access(tags), fee, Number.isFinite(capacity) && capacity > 0 ? capacity : 0]);
  }
  return { carParks, streets: [...cells.values()], parkRide };
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  if (process.env.FETCH !== "0") {
    const osm = await fetchOsm();
    if (osm) writeFileSync(OSM_FILE, JSON.stringify(osm));
    else console.warn("Keeping the previous OSM snapshot (if any).");
    const meters = await fetchMeters();
    if (meters) writeFileSync(MSIP_FILE, JSON.stringify(meters));
    else console.warn("Keeping the previous meters snapshot (if any).");
  }

  const osmRaw = readRaw<OsmElement>(OSM_FILE);
  const metersRaw = readRaw<MeterRow>(MSIP_FILE);
  if (!osmRaw && !metersRaw) throw new Error("No parking source available: nothing to build from.");
  const { carParks, streets, parkRide } = osmRaw ? convert(osmRaw.items) : { carParks: [], streets: [], parkRide: [] };
  const data: ParkingData = {
    retrieved: { osm: osmRaw?.retrieved ?? null, msip: metersRaw?.retrieved ?? null },
    metersAsOf: metersRaw ? METERS_AS_OF : null,
    carParks,
    streets,
    parkRide,
    meters: metersRaw?.items ?? [],
  };
  writeFileSync(OUT_FILE, JSON.stringify(data) + "\n");
  console.log(`wrote ${OUT_FILE}: ${carParks.length} off-street car parks (${carParks.filter((c) => c[3] === "public").length} public), ${streets.length} street cells (${streets.reduce((n, s) => n + s[2], 0)} segments), ${parkRide.length} park & ride, ${data.meters.length} meters`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
