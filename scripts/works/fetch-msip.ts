// Downloads official investment-related tree-removal permits from the city's public GIS (MSIP) to
// data/works/msip-permits.json. A permit means an investment on that plot is being prepared or started; the
// source publishes no construction schedule, so these rows are shown as "permit issued", never as dated works.
// Only decisions marked "INWESTYCJA" are kept (refusals, discontinued and amended decisions are dropped).
// Usage: npx tsx scripts/works/fetch-msip.ts
import { writeFileSync } from "node:fs";

const SERVICE = "https://msip.um.krakow.pl/arcgis/rest/services/Obserwatorium/WS_wycinka_inwestycje_uchwala/MapServer";
const LAYERS = [0, 1]; // issued this year, issued last year
const MAX_AGE_DAYS = 365;

type Feature = {
  geometry: GeoJSON.Geometry;
  properties: { decyzja: string; data_wydania: number | null; lokalizacja: string | null; znak_decyzji: string | null };
};

const isInvestmentPermit = (d: string) => /^0[34] - USUNIĘCIE/i.test(d.trim()) && /INWESTYCJA/i.test(d);

async function layer(id: number): Promise<Feature[]> {
  const url = `${SERVICE}/${id}/query?where=1%3D1&outFields=decyzja,data_wydania,lokalizacja,znak_decyzji&outSR=4326&f=geojson&resultRecordCount=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MSIP layer ${id}: HTTP ${res.status}`);
  const json = (await res.json()) as { features?: Feature[] };
  return json.features ?? [];
}

async function main() {
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const kept: { ref: string; issued: string; geometry: GeoJSON.Geometry }[] = [];
  for (const id of LAYERS) {
    for (const f of await layer(id)) {
      const { decyzja, data_wydania, znak_decyzji } = f.properties;
      if (!isInvestmentPermit(decyzja) || !data_wydania || data_wydania < cutoff || !f.geometry) continue;
      kept.push({ ref: znak_decyzji ?? "", issued: new Date(data_wydania).toISOString().slice(0, 10), geometry: f.geometry });
    }
  }
  writeFileSync(
    "data/works/msip-permits.json",
    JSON.stringify({ retrieved: new Date().toISOString().slice(0, 10), service: SERVICE, permits: kept }) + "\n",
  );
  console.log(`kept ${kept.length} investment tree-removal permits issued in the last ${MAX_AGE_DAYS} days`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
