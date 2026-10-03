// Writes a small, deterministic sample of the full OSM extracts (data/osm/full/*.json) to
// data/osm/*.json so the pipeline can run for tests/dev without the full download.
// Usage: npx tsx scripts/osm/sample.ts   (after: OSM_DIR=data/osm/full npx tsx scripts/osm/fetch.ts)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { classifyPoi } from "../../src/lib/data/osm";

const FULL = process.env.OSM_FULL_DIR ?? "data/osm/full";
const OUT = process.env.OSM_DIR ?? "data/osm";
const POIS_PER_CATEGORY = 150;
const GREEN_AREAS = 60;
const DISTRICTS = 3;
const MAX_ELEMENT_BYTES = 12_000; // skip huge polygons to keep the committed sample small

type El = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: { lat: number; lon: number }[];
};
const read = (name: string): El[] => JSON.parse(readFileSync(`${FULL}/${name}.json`, "utf8"));
const byId = (a: El, b: El) => a.id - b.id;

function bboxArea(el: El): number {
  const b = el.bounds;
  if (b) return (b.maxlat - b.minlat) * (b.maxlon - b.minlon);
  const g = el.geometry ?? [];
  if (!g.length) return 0;
  const lats = g.map((p) => p.lat);
  const lons = g.map((p) => p.lon);
  return (Math.max(...lats) - Math.min(...lats)) * (Math.max(...lons) - Math.min(...lons));
}

const perCategory: Record<string, El[]> = {};
for (const el of read("pois").sort(byId)) {
  const c = classifyPoi(el.tags ?? {});
  if (!c) continue;
  (perCategory[c.category] ??= []).length < POIS_PER_CATEGORY && perCategory[c.category].push(el);
}
const pois = Object.values(perCategory).flat();
const green = read("green")
  .filter((e) => e.type !== "node" && JSON.stringify(e).length <= MAX_ELEMENT_BYTES)
  .sort((a, b) => bboxArea(b) - bboxArea(a) || a.id - b.id)
  .slice(0, GREEN_AREAS);
const districts = read("districts")
  .filter((e) => JSON.stringify(e).length <= MAX_ELEMENT_BYTES * 6)
  .sort(byId)
  .slice(0, DISTRICTS);

mkdirSync(OUT, { recursive: true });
for (const [name, els] of Object.entries({ pois, green, districts })) {
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(els));
  console.log(name, els.length, "elements");
}
