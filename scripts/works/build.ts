// Builds supabase/seed-works.sql from (1) the hand-reviewed curated works and (2) the official MSIP permits.
//
// Curated works (data/works/curated.json) only reach the database if:
//   - reviewed is true,
//   - every evidence quote appears verbatim in the saved official page (data/works/snapshots/<snapshot>.txt),
//   - each stated date (day + month, and year when the quote has one) appears in the quotes, unless a reviewed
//     whenLabel describes vague timing, and
//   - every location resolves to coordinates inside Kraków (city geocoder, or an official ZTP stop by name).
// Nothing is guessed: a record that fails any check aborts the build.
//
// It also writes src/lib/data/works-map.json (the same records as GeoJSON, no evidence text) for the map-wide
// timeline layer served by GET /api/works — so the layer never depends on a live database call.
//
// Usage: npx tsx scripts/works/build.ts   (refresh inputs first: snapshot.ts, fetch-msip.ts)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { norm, verifyEvidence } from "../../src/lib/data/works-verify";

const OUT_FILE = process.env.OUT_FILE ?? "supabase/seed-works.sql";
const MAP_FILE = process.env.MAP_FILE ?? "src/lib/data/works-map.json";
const GEOCODER = "https://msip.um.krakow.pl/arcgis/rest/services/epl/Lokalizator_Krakow/GeocodeServer/findAddressCandidates";
const CACHE_FILE = "data/works/geocode-cache.json";
const KRAKOW_BBOX = { w: 19.79, e: 20.22, s: 49.95, n: 50.13 };

type Curated = {
  id: string; title: string;
  kind: string; status: "ongoing" | "planned";
  dateFrom: string | null; dateTo: string | null; whenLabel: string | null;
  source: "zdmk" | "krakow_pl" | "zim"; snapshot: string; publishedAt: string | null;
  evidence: string[]; locations: string[]; reviewed: boolean;
};
type Sources = Record<string, { url: string; name: string }>;
type Pt = [number, number]; // lng, lat

const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);

const cache: Record<string, Pt> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};

async function geocode(query: string): Promise<Pt> {
  if (cache[`geocode:${query}`]) return cache[`geocode:${query}`];
  const url = `${GEOCODER}?SingleLine=${encodeURIComponent(query)}&outSR=4326&maxLocations=1&f=json`;
  const res = await fetch(url);
  const json = (await res.json()) as { candidates?: { score: number; location: { x: number; y: number } }[] };
  const c = json.candidates?.[0];
  if (!c || c.score < 90) throw new Error(`geocoder found no confident match for "${query}"`);
  return (cache[`geocode:${query}`] = [c.location.x, c.location.y]);
}

/** Centroid of the official ZTP stops carrying this name (data/gtfs/stops.json, committed). */
function stopCentroid(name: string): Pt {
  const stops = (JSON.parse(readFileSync("data/gtfs/stops.json", "utf8")) as { stops: { name: string; at: Pt }[] }).stops;
  const hit = stops.filter((s) => s.name === name);
  if (!hit.length) throw new Error(`no ZTP stop named "${name}"`);
  return [hit.reduce((a, s) => a + s.at[0], 0) / hit.length, hit.reduce((a, s) => a + s.at[1], 0) / hit.length];
}

async function resolve(loc: string): Promise<Pt> {
  const [kind, ...rest] = loc.split(":");
  const name = rest.join(":");
  const pt = kind === "geocode" ? await geocode(name) : kind === "stop" ? stopCentroid(name) : null;
  if (!pt) throw new Error(`unknown location type "${loc}"`);
  if (pt[0] < KRAKOW_BBOX.w || pt[0] > KRAKOW_BBOX.e || pt[1] < KRAKOW_BBOX.s || pt[1] > KRAKOW_BBOX.n) {
    throw new Error(`"${loc}" resolved outside Kraków: ${pt}`);
  }
  return pt;
}

function verify(r: Curated, snapshots: Record<string, string>) {
  const text = snapshots[r.snapshot];
  if (!text) throw new Error(`${r.id}: missing snapshot "${r.snapshot}" (run scripts/works/snapshot.ts)`);
  verifyEvidence(r, text);
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;
const round = (g: unknown): unknown =>
  Array.isArray(g) ? g.map(round) : typeof g === "number" ? r5(g) : g && typeof g === "object" ? Object.fromEntries(Object.entries(g).map(([k, v]) => [k, round(v)])) : g;
const geom = (g: unknown) => `st_setsrid(st_geomfromgeojson(${q(JSON.stringify(round(g)))}),4326)`;

async function main() {
  const sources = JSON.parse(readFileSync("data/works/sources.json", "utf8")) as Sources;
  const curated = (JSON.parse(readFileSync("data/works/curated.json", "utf8")) as Curated[]).filter((r) => r.reviewed);
  const snapshots = Object.fromEntries(
    Object.keys(sources).map((k) => [k, existsSync(`data/works/snapshots/${k}.txt`) ? norm(readFileSync(`data/works/snapshots/${k}.txt`, "utf8")) : ""]),
  );

  const rows: string[] = [];
  const features: GeoJSON.Feature[] = [];
  for (const r of curated) {
    verify(r, snapshots);
    const pts = await Promise.all(r.locations.map(resolve));
    const g = pts.length === 1 ? { type: "Point", coordinates: pts[0] } : { type: "LineString", coordinates: pts };
    const src = sources[r.snapshot];
    features.push({
      type: "Feature",
      properties: { id: r.id, title: r.title, kind: r.kind, status: r.status, dateFrom: r.dateFrom, dateTo: r.dateTo, whenLabel: r.whenLabel, sourceName: src.name, sourceUrl: src.url, publishedAt: r.publishedAt },
      geometry: round(g) as GeoJSON.Geometry,
    });
    rows.push(
      `(${q(r.id)},${q(r.title)},${q(r.kind)},${q(r.status)},${q(r.dateFrom)},${q(r.dateTo)},${q(r.whenLabel)},${q(r.source)},${q(src.name)},${q(src.url)},${q(r.publishedAt)},${q(norm(r.evidence.join(" … ")))},${geom(g)})`,
    );
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + "\n");

  // Permits: one row per decision (several plots of the same decision become one geometry collection).
  let permits = 0;
  if (existsSync("data/works/msip-permits.json")) {
    const file = JSON.parse(readFileSync("data/works/msip-permits.json", "utf8")) as {
      service: string; permits: { ref: string; issued: string; geometry: GeoJSON.Geometry }[];
    };
    const byRef = new Map<string, { issued: string; geometries: GeoJSON.Geometry[] }>();
    file.permits.forEach((p, i) => {
      const key = p.ref || `row-${i}`;
      const e = byRef.get(key) ?? { issued: p.issued, geometries: [] };
      e.geometries.push(p.geometry);
      byRef.set(key, e);
    });
    for (const [ref, e] of byRef) {
      const g = e.geometries.length === 1 ? e.geometries[0] : { type: "GeometryCollection", geometries: e.geometries };
      const props = { id: `msip:${ref}`, title: "Pozwolenie na wycinkę drzew przy inwestycji", kind: "other", status: "decision", dateFrom: e.issued, dateTo: null, whenLabel: null, sourceName: "Miasto Kraków (MSIP): decyzje o wycince drzew związane z inwestycjami", sourceUrl: `${file.service}/0`, publishedAt: e.issued };
      e.geometries.forEach((geometry) => features.push({ type: "Feature", properties: props, geometry: round(geometry) as GeoJSON.Geometry }));
      rows.push(
        `(${q(`msip:${ref}`)},'Tree-removal permit issued for an investment','other','decision',${q(e.issued)},null,null,'msip','City of Kraków GIS (MSIP): tree-removal decisions linked to investments',${q(`${file.service}/0`)},${q(e.issued)},${q(`Decision ${ref}`)},${geom(g)})`,
      );
    }
    permits = byRef.size;
  }

  const sql = [
    "truncate public.works restart identity;",
    ...Array.from({ length: Math.ceil(rows.length / 25) }, (_, i) =>
      `insert into public.works (ext_id,title,kind,status,date_from,date_to,when_label,source,source_name,source_url,published_at,evidence,geometry) values\n${rows.slice(i * 25, (i + 1) * 25).join(",\n")};`,
    ),
  ].join("\n");
  writeFileSync(OUT_FILE, sql + "\n");
  writeFileSync(MAP_FILE, JSON.stringify({ type: "FeatureCollection", features }) + "\n");
  console.log(`wrote ${OUT_FILE}: ${curated.length} curated works + ${permits} permits`);
}

main().catch((e) => {
  console.error("BUILD FAILED:", e.message ?? e);
  process.exit(1);
});
