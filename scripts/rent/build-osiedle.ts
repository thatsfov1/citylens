// Neighbourhood-level rent: builds src/lib/data/rent-osiedle.json from data/rent/listings-osiedle.json (scripts/rent/osiedle-check.ts).
// Usage: npx tsx scripts/rent/build-osiedle.ts      (needs data/rent/full/streets.json from scripts/rent/streets-from-pbf.py)
//
// 1. Per "District › Neighbourhood" and flat size: the same stats as the district table (n, quartiles, czynsz, every offer).
// 2. Which neighbourhood a hexagon belongs to. Otodom's neighbourhoods have no boundaries here, so each listing's street is looked up
//    among OSM street names, kept to cells inside the listing's own district, and the cell takes the neighbourhood that most of its
//    listings belong to. Cells with no listing of their own stay unassigned and use the district figure (never a guessed value).
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { latLngToCell } from "h3-js";
import { H3_RESOLUTION } from "../../src/lib/h3/config";
import rentData from "../../src/lib/data/rent-data.json";

type Row = { id: number; district: string; area: string | null; slug: string | null; street: string | null; rooms: number; price: number; fee: number | null };
type Group = { n: number; p25: number; median: number; p75: number; fee: number | null; feeKnown: number; offers: [number, number | null][] };

const MIN_N = 5; // same as the district table
const MIN_CELL_WEIGHT = 0.5; // listing-equivalents a cell needs before it is assigned a neighbourhood

const rows = (JSON.parse(readFileSync("data/rent/listings-osiedle.json", "utf8")) as Row[]).filter((r) => r.area);
const streets = JSON.parse(readFileSync("data/rent/full/streets.json", "utf8")) as Record<string, [number, number][]>;

const hexDistrict = new Map<string, string>();
for (const line of readFileSync("supabase/seed.sql", "utf8").split("\n")) {
  const m = /^\('(\w+)',.*?,(null|\d+),(null|\d+),'([^']*)','\{/.exec(line);
  if (m) hexDistrict.set(m[1], m[4]);
}

// ---- street names: drop prefixes, titles and house numbers so "gen. Leopolda Okulickiego 5A" meets "generała Leopolda Okulickiego" ----
const STOP = new Set(
  "ul ulica al aleja pl plac os osiedle rondo bulwar gen generała dr doktora prof profesora płk pułkownika ppłk bp biskupa abp ks księdza kard kardynała św świętego świętej im mjr majora kpt kapitana por rtm hm marsz marszałka o ojca inż mgr hr hrabiego".split(" "),
);
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !/\d/.test(t) && !STOP.has(t))
    .join(" ");
const index = new Map<string, [number, number][]>();
for (const [name, pts] of Object.entries(streets)) {
  const k = norm(name);
  if (k) index.set(k, [...(index.get(k) ?? []), ...pts]);
}
const keys = [...index.keys()];
function pointsFor(street: string): [number, number][] | null {
  const n = norm(street);
  if (!n) return null;
  const exact = index.get(n);
  if (exact) return exact;
  // Otodom often drops a first name that OSM has ("al. Słowackiego" / "Juliusza Słowackiego"): accept a whole-word suffix either way.
  const near = keys.filter((k) => k.endsWith(` ${n}`) || n.endsWith(` ${k}`));
  return near.length ? near.flatMap((k) => index.get(k) as [number, number][]) : null;
}

// ---- stats per neighbourhood and flat size ----
const quantile = (s: number[], q: number) => {
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(s[lo] + (s[hi] - s[lo]) * (pos - lo));
};
const bucket = (rooms: number) => String(Math.min(rooms, 3));
const districtFee = (district: string, b: string) =>
  ((rentData.districts as Record<string, Record<string, { fee: number | null }>>)[district]?.[b]?.fee ?? (rentData.city as Record<string, { fee: number | null }>)[b]?.fee) ?? null;

const key = (r: Row) => `${r.district} › ${r.area}`;
const areas: Record<string, Record<string, Group>> = {};
const slugs: Record<string, string> = {};
const byKey = new Map<string, Row[]>();
for (const r of rows) byKey.set(key(r), [...(byKey.get(key(r)) ?? []), r]);
for (const [k, list] of byKey) {
  for (const b of ["1", "2", "3"]) {
    const g = list.filter((r) => bucket(r.rooms) === b);
    if (g.length < MIN_N) continue;
    const prices = g.map((r) => r.price).sort((x, y) => x - y);
    const fees = g.flatMap((r) => (r.fee == null ? [] : [r.fee])).sort((x, y) => x - y);
    (areas[k] ??= {})[b] = {
      n: prices.length,
      p25: quantile(prices, 0.25),
      median: quantile(prices, 0.5),
      p75: quantile(prices, 0.75),
      // A neighbourhood's own typical czynsz when enough ads state it, otherwise its district's.
      fee: fees.length >= 3 ? quantile(fees, 0.5) : districtFee(list[0].district, b),
      feeKnown: fees.length,
      offers: g.map((r) => [r.price, r.fee] as [number, number | null]),
    };
  }
  const slug = list.find((r) => r.slug)?.slug;
  if (slug && areas[k]) slugs[k] = slug;
}

// ---- which neighbourhood does each cell belong to? ----
const weight = new Map<string, Map<string, number>>(); // cell -> area name -> listing-equivalents
let noStreet = 0, notFound = 0, outside = 0, resolved = 0;
for (const r of rows) {
  if (!r.street) { noStreet++; continue; }
  const pts = pointsFor(r.street);
  if (!pts) { notFound++; continue; }
  const cells = new Set<string>();
  for (const [lng, lat] of pts) {
    const h = latLngToCell(lat, lng, H3_RESOLUTION);
    if (hexDistrict.get(h) === r.district) cells.add(h);
  }
  if (cells.size === 0) { outside++; continue; }
  resolved++;
  for (const h of cells) {
    const m = weight.get(h) ?? new Map<string, number>();
    m.set(r.area as string, (m.get(r.area as string) ?? 0) + 1 / cells.size);
    weight.set(h, m);
  }
}
const cells: Record<string, string> = {};
for (const [h, m] of weight) {
  const [area, w] = [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const district = hexDistrict.get(h) as string;
  if (w >= MIN_CELL_WEIGHT && areas[`${district} › ${area}`]) cells[h] = area;
}

const out = {
  source: rentData.source,
  // The scrape date: the day the listings file was written.
  snapshot: statSync("data/rent/listings-osiedle.json").mtime.toISOString().slice(0, 10),
  listings: rows.length,
  minListings: MIN_N,
  areas,
  slugs,
  cells,
};
writeFileSync("src/lib/data/rent-osiedle.json", JSON.stringify(out) + "\n");
const share = Math.round((100 * resolved) / rows.length);
console.log({ listings: rows.length, noStreet, notFound, outside, resolved, resolvedPct: share });
console.log(`${Object.keys(areas).length} neighbourhoods with a table, ${Object.keys(cells).length} of ${hexDistrict.size} cells assigned to one`);
