// Computes real OSM-based hex scores and writes supabase/seed.sql.
// Usage: npx tsx scripts/osm/compute.ts   (needs data/osm/*.json from scripts/osm/fetch.ts)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cellToLatLng } from "h3-js";
import { cellPolygon, getDemoCells } from "../../src/lib/h3/grid";
import { parseDistricts, parseGreen, parsePois, type PoiCategory } from "../../src/lib/data/osm";
import { combineTransport, type GtfsFile } from "../../src/lib/data/gtfs";
import { cityLitShare, combineSafety, crimeIndicator, rankScores, scoreLighting, type CrimeFile, type LightingFile, type SafetyIndicators } from "../../src/lib/data/safety";
import { CATEGORY_DISTANCE_SCALE, findDistrict, normalizeRaw, scoreGreenery, scorePoiCategory } from "../../src/lib/data/score-hex";
import type { LngLat } from "../../src/lib/data/geo";
import type { Category } from "../../src/types";

const OSM_DIR = process.env.OSM_DIR ?? "data/osm";
const read = (name: string) => {
  const path = `${OSM_DIR}/${name}.json`;
  if (!existsSync(path)) throw new Error(`${path} missing — run: npx tsx scripts/osm/fetch.ts`);
  return JSON.parse(readFileSync(path, "utf8"));
};

function main() {
  const pois = parsePois(read("pois"));
  const green = parseGreen(read("green"));
  const districts = parseDistricts(read("districts"));
  console.log({ pois: pois.length, green: green.length, districts: districts.length });

  const cells = getDemoCells();
  const poiCats: PoiCategory[] = ["sport", "culture", "shopping", "transport"];
  const byCat = Object.fromEntries(poiCats.map((c) => [c, pois.filter((p) => p.category === c)])) as Record<PoiCategory, typeof pois>;

  // Transport: measured GTFS service for bus/tram (built by scripts/gtfs/build.ts); OSM only adds rail stations,
  // which the city feeds don't cover. Without data/gtfs/stops.json we fall back to OSM stops.
  const gtfsPath = process.env.GTFS_FILE ?? "data/gtfs/stops.json";
  if (existsSync(gtfsPath)) {
    byCat.transport = combineTransport(byCat.transport, JSON.parse(readFileSync(gtfsPath, "utf8")) as GtfsFile);
    console.log("transport: GTFS stops + OSM rail stations,", byCat.transport.length, "places");
  } else console.log("transport: OSM stops only (no", gtfsPath + ")");

  // Safety: street lighting from OSM (data/safety/lighting.json) and, if a real dataset is present,
  // official crime statistics (data/safety/crime.json). Cells without any data get a null safety score.
  const lightingPath = process.env.LIGHTING_FILE ?? "data/safety/lighting.json";
  const crimePath = process.env.CRIME_FILE ?? "data/safety/crime.json";
  const lighting = existsSync(lightingPath) ? (JSON.parse(readFileSync(lightingPath, "utf8")) as LightingFile) : null;
  const crime = existsSync(crimePath) ? (JSON.parse(readFileSync(crimePath, "utf8")) as CrimeFile) : null;
  const litShare = lighting ? cityLitShare(lighting) : 0;
  console.log("safety:", lighting ? `lighting ${lighting.points.length} segments` : "no lighting data", "|", crime ? `crime ${crime.year}` : "no crime data");

  const rows = cells.map((h3Index) => {
    const [lat, lng] = cellToLatLng(h3Index);
    const center: LngLat = [lng, lat];
    const indicators = {
      ...(Object.fromEntries(poiCats.map((c) => [c, scorePoiCategory(center, byCat[c], CATEGORY_DISTANCE_SCALE[c])])) as Record<PoiCategory, ReturnType<typeof scorePoiCategory>>),
      greenery: scoreGreenery(center, green),
    };
    const district = findDistrict(center, districts);
    const safety: SafetyIndicators = {};
    const l = lighting ? scoreLighting(center, lighting, litShare) : null;
    if (l) safety.lighting = l;
    const c = crime ? crimeIndicator(district, crime) : null;
    if (c) safety.crime = c;
    return { h3Index, district, indicators: { ...indicators, ...(l || c ? { safety } : {}) } };
  });

  // Per-indicator scores are percentile ranks over the cells that have data (higher = better), then combined.
  const rank = (get: (r: (typeof rows)[number]) => number | undefined) => {
    const idx = rows.map((r, i) => [i, get(r)] as const).filter((x): x is readonly [number, number] => x[1] !== undefined);
    const ranks = rankScores(idx.map((x) => x[1]));
    const out = new Map<number, number>();
    idx.forEach(([i], k) => out.set(i, ranks[k]));
    return out;
  };
  const lightRank = rank((r) => r.indicators.safety?.lighting?.litShare);
  const crimeRank = rank((r) => (r.indicators.safety?.crime ? -r.indicators.safety.crime.per1000 : undefined)); // fewer crimes → higher
  const safetyScores = rows.map((_, i) => combineSafety({ lighting: lightRank.get(i), crime: crimeRank.get(i) }));

  const categories: Category[] = ["sport", "culture", "greenery", "shopping", "transport"];
  const scores = Object.fromEntries(categories.map((c) => [c, normalizeRaw(rows.map((r) => r.indicators[c].raw))])) as Record<Category, number[]>;

  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const values = rows.map((r, i) => {
    const { greenery, ...rest } = r.indicators; // `rest` still carries safety when present
    const ind = JSON.stringify({ ...rest, greenery }, (k, v) => (k === "raw" || k === "litShare" ? Math.round(v * 1000) / 1000 : v));
    const wkt = `POLYGON((${cellPolygon(r.h3Index).map(([x, y]) => `${x.toFixed(6)} ${y.toFixed(6)}`).join(",")}))`;
    return `(${q(r.h3Index)},ST_GeomFromText('${wkt}',4326),${scores.sport[i]},${scores.culture[i]},${scores.greenery[i]},${scores.shopping[i]},${scores.transport[i]},${safetyScores[i] ?? "null"},${r.district ? q(r.district) : "null"},${q(ind)}::jsonb)`;
  });
  writeFileSync(
    "supabase/seed.sql",
    `insert into public.hex_scores (h3_index, geometry, sport_score, culture_score, greenery_score, shopping_score, transport_score, safety_score, district, indicators) values\n${values.join(",\n")}\non conflict (h3_index) do update set geometry=excluded.geometry, sport_score=excluded.sport_score, culture_score=excluded.culture_score, greenery_score=excluded.greenery_score, shopping_score=excluded.shopping_score, transport_score=excluded.transport_score, safety_score=excluded.safety_score, district=excluded.district, indicators=excluded.indicators;\n`,
  );
  console.log("wrote supabase/seed.sql with", rows.length, "rows;", rows.filter((r) => !r.district).length, "without district");
}
main();
