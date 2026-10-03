// Computes real OSM-based hex scores and writes supabase/seed.sql.
// Usage: npx tsx scripts/osm/compute.ts   (needs data/osm/*.json from scripts/osm/fetch.ts)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cellToLatLng } from "h3-js";
import { getDemoCells } from "../../src/lib/h3/grid";
import { parseDistricts, parseGreen, parsePois, type PoiCategory } from "../../src/lib/data/osm";
import { findDistrict, normalizeRaw, scoreGreenery, scorePoiCategory } from "../../src/lib/data/score-hex";
import type { LngLat } from "../../src/lib/data/geo";
import type { Category } from "../../src/types";

const read = (name: string) => {
  const path = `data/osm/${name}.json`;
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

  const rows = cells.map((h3Index) => {
    const [lat, lng] = cellToLatLng(h3Index);
    const center: LngLat = [lng, lat];
    const indicators = {
      ...(Object.fromEntries(poiCats.map((c) => [c, scorePoiCategory(center, byCat[c])])) as Record<PoiCategory, ReturnType<typeof scorePoiCategory>>),
      greenery: scoreGreenery(center, green),
    };
    return { h3Index, district: findDistrict(center, districts), indicators };
  });

  const categories: Category[] = ["sport", "culture", "greenery", "shopping", "transport"];
  const scores = Object.fromEntries(categories.map((c) => [c, normalizeRaw(rows.map((r) => r.indicators[c].raw))])) as Record<Category, number[]>;

  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const values = rows.map((r, i) => {
    const { greenery, ...rest } = r.indicators;
    const ind = JSON.stringify({ ...rest, greenery }, (k, v) => (k === "raw" ? Math.round(v * 1000) / 1000 : v));
    return `(${q(r.h3Index)},${scores.sport[i]},${scores.culture[i]},${scores.greenery[i]},${scores.shopping[i]},${scores.transport[i]},${r.district ? q(r.district) : "null"},${q(ind)}::jsonb)`;
  });
  writeFileSync(
    "supabase/seed.sql",
    `insert into public.hex_scores (h3_index, sport_score, culture_score, greenery_score, shopping_score, transport_score, district, indicators) values\n${values.join(",\n")}\non conflict (h3_index) do update set sport_score=excluded.sport_score, culture_score=excluded.culture_score, greenery_score=excluded.greenery_score, shopping_score=excluded.shopping_score, transport_score=excluded.transport_score, district=excluded.district, indicators=excluded.indicators;\n`,
  );
  console.log("wrote supabase/seed.sql with", rows.length, "rows;", rows.filter((r) => !r.district).length, "without district");
}
main();
