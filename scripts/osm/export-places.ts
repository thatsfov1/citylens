// Exports individual places + green outlines (pins shown when a hexagon is opened) to supabase/seed-places.sql.
// Usage: OSM_DIR=data/osm/full npx tsx scripts/osm/export-places.ts   (default: the small sample in data/osm)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseGreen, parsePois } from "../../src/lib/data/osm";
import type { Ring } from "../../src/lib/data/geo";

const OSM_DIR = process.env.OSM_DIR ?? "data/osm";
const MIN_GREEN_M2 = 5_000;
const read = (name: string) => {
  const path = `${OSM_DIR}/${name}.json`;
  if (!existsSync(path)) throw new Error(`${path} missing — run: npx tsx scripts/osm/fetch.ts`);
  return JSON.parse(readFileSync(path, "utf8"));
};

const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Rounds to ~1 m and drops points that collapse onto their predecessor; keeps rings closed. */
function simplify(ring: Ring): Ring {
  const out: Ring = [];
  for (const [x, y] of ring) {
    const p: [number, number] = [r5(x), r5(y)];
    const last = out.at(-1);
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length >= 3 && (out[0][0] !== out.at(-1)![0] || out[0][1] !== out.at(-1)![1])) out.push(out[0]);
  return out;
}

function main() {
  const pois = parsePois(read("pois"));
  const green = parseGreen(read("green")).filter((g) => g.areaM2 >= MIN_GREEN_M2);

  const poiRows = pois.map((p) => `(${q(p.category)},${q(p.kind)},${q(p.name)},${r5(p.at[1])},${r5(p.at[0])})`);
  const greenRows = green.map((g) => {
    const coordinates = g.polygons
      .map((poly) => poly.map(simplify).filter((r) => r.length >= 4))
      .filter((poly) => poly.length > 0);
    const [w, s, e, n] = g.bbox;
    return `(${q(g.name)},${Math.round(g.areaM2 / 100) / 100},${s},${n},${w},${e},${q(JSON.stringify({ type: "MultiPolygon", coordinates }))}::jsonb)`;
  });

  const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));
  const sql = [
    "truncate public.pois, public.green_areas restart identity;",
    ...chunks(poiRows, 500).map((c) => `insert into public.pois (category, kind, name, lat, lng) values\n${c.join(",\n")};`),
    ...chunks(greenRows, 50).map((c) => `insert into public.green_areas (name, area_ha, min_lat, max_lat, min_lng, max_lng, geometry) values\n${c.join(",\n")};`),
  ].join("\n");
  writeFileSync("supabase/seed-places.sql", sql + "\n");
  console.log(`wrote supabase/seed-places.sql: ${poiRows.length} pois, ${greenRows.length} green areas (from ${OSM_DIR})`);
}
main();
