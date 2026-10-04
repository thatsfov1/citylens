// Builds data/air/stations.json: PM2.5 / PM10 at Kraków's official air-quality stations (GIOŚ).
// Usage: npx tsx scripts/air/build-air.ts
// Data: Główny Inspektorat Ochrony Środowiska (GIOŚ), https://powietrze.gios.gov.pl — public API, no key needed.
// The API only serves the last ~3 days of hourly values, so each station gets the mean of those (a snapshot, not
// an annual figure). Commit the file once generated so the demo works offline. GET /api/air reads the same API live.
import { mkdirSync, writeFileSync } from "node:fs";
import { fetchGiosStations } from "../../src/lib/data/gios";

async function main() {
  const file = await fetchGiosStations({ windowHours: null, minHours: 24, attempts: 4, timeoutMs: 30_000 });
  for (const s of file.stations) console.log(s.name, "pm25", s.pm25 ?? "-", "pm10", s.pm10 ?? "-");
  mkdirSync("data/air", { recursive: true });
  writeFileSync("data/air/stations.json", JSON.stringify(file, null, 1) + "\n");
  console.log("wrote data/air/stations.json with", file.stations.length, "stations");
}
main();
