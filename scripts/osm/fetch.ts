// Downloads raw OpenStreetMap data for Kraków into data/osm/*.json (committed, so the demo
// never depends on live Overpass). Usage: npx tsx scripts/osm/fetch.ts [pois|green|districts]
// Data © OpenStreetMap contributors, ODbL.
import { mkdirSync, writeFileSync } from "node:fs";

const BBOX = "49.95,19.75,50.15,20.15"; // s,w,n,e — covers the city with margin
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const QUERIES: Record<string, string> = {
  pois: `[out:json][timeout:180];(
  nwr["leisure"~"^(sports_centre|fitness_centre|pitch|swimming_pool|stadium)$"](${BBOX});
  nwr["tourism"="museum"](${BBOX});
  nwr["amenity"~"^(theatre|cinema|arts_centre|library)$"](${BBOX});
  nwr["shop"](${BBOX});
  node["highway"="bus_stop"](${BBOX});
  node["railway"~"^(tram_stop|station|halt)$"](${BBOX});
);out center tags;`,
  green: `[out:json][timeout:180];(
  nwr["leisure"~"^(park|garden|nature_reserve)$"](${BBOX});
  nwr["landuse"~"^(forest|recreation_ground|village_green)$"](${BBOX});
  nwr["natural"="wood"](${BBOX});
);out geom tags;`,
  districts: `[out:json][timeout:180];
area["name"="Kraków"]["admin_level"="6"]->.k;
rel(area.k)["boundary"="administrative"]["admin_level"="9"];
out geom tags;`,
};

async function run(name: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: QUERIES[name] }),
        headers: { "User-Agent": "winhackyeah-smart-city/0.1" },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as { elements: unknown[] };
      mkdirSync("data/osm", { recursive: true });
      writeFileSync(`data/osm/${name}.json`, JSON.stringify(json.elements));
      console.log(name, json.elements.length, "elements from", url);
      return;
    } catch (e) {
      console.warn(name, "failed on", url, String(e));
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error(`could not fetch ${name}`);
}

async function main() {
  const only = process.argv[2];
  for (const name of Object.keys(QUERIES)) if (!only || only === name) await run(name);
}
main();
