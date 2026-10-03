// Builds data/air/stations.json: PM2.5 / PM10 at Kraków's official air-quality stations (GIOŚ).
// Usage: npx tsx scripts/air/build-air.ts
// Data: Główny Inspektorat Ochrony Środowiska (GIOŚ), https://powietrze.gios.gov.pl — public API, no key needed.
// The API only serves the last ~3 days of hourly values, so each station gets the mean of those (a snapshot, not
// an annual figure). Commit the file once generated so the demo works offline.
import { mkdirSync, writeFileSync } from "node:fs";
import type { AirFile, AirStation } from "../../src/lib/data/air";

const API = "https://api.gios.gov.pl/pjp-api/v1/rest";
const MIN_HOURS = 24; // fewer valid hourly values than this → not a representative snapshot

/** Parsed JSON; null on a 400, which the API uses for manual (non-live) sensors — no retry, just no data. */
async function get<T>(path: string): Promise<T | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API}/${path}`, { signal: AbortSignal.timeout(30_000) });
      if (res.status === 400) return null;
      if (!res.ok) throw new Error(`${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      console.warn(path, "failed:", String(e));
      await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
    }
  }
  throw new Error(`could not fetch ${path}`);
}

type RawStation = Record<string, string | number>;
type RawSensor = Record<string, string | number>;
type RawData = { "Lista danych pomiarowych": { Data: string; Wartość: number | null }[] };

/** Mean of the hourly values of one sensor, plus the newest timestamp; null if too little data. */
async function sensorMean(sensorId: number): Promise<{ mean: number; hours: number; latest: string } | null> {
  const data = await get<RawData>(`data/getData/${sensorId}?size=500&dayNumber=30`);
  if (!data) return null;
  const rows = data["Lista danych pomiarowych"].filter((r) => r.Wartość !== null);
  if (rows.length < MIN_HOURS) return null;
  const mean = rows.reduce((s, r) => s + (r.Wartość as number), 0) / rows.length;
  const latest = rows.map((r) => r.Data).sort().at(-1) as string;
  return { mean, hours: rows.length, latest };
}

async function main() {
  const all = await get<Record<string, RawStation[]>>("station/findAll?size=500&page=0");
  if (!all) throw new Error("station list unavailable");
  const krakow = all["Lista stacji pomiarowych"].filter((s) => s["Nazwa miasta"] === "Kraków");
  console.log(krakow.length, "stations in Kraków");

  const stations: AirStation[] = [];
  for (const s of krakow) {
    const id = s["Identyfikator stacji"] as number;
    const sensorList = await get<Record<string, RawSensor[]>>(`station/sensors/${id}`);
    const sensors = sensorList?.["Lista stanowisk pomiarowych dla podanej stacji"] ?? [];
    const out: AirStation = {
      id,
      name: String(s["Nazwa stacji"]).replace(/^Kraków,\s*/, ""),
      lng: Number(s["WGS84 λ E"]),
      lat: Number(s["WGS84 φ N"]),
    };
    for (const [key, code] of [["pm25", "PM2.5"], ["pm10", "PM10"]] as const) {
      const sensor = sensors.find((x) => x["Wskaźnik - kod"] === code);
      if (!sensor) continue;
      const m = await sensorMean(sensor["Identyfikator stanowiska"] as number);
      if (m) {
        out[key] = Math.round(m.mean * 10) / 10;
        out.asOf = !out.asOf || m.latest > out.asOf ? m.latest : out.asOf;
      }
    }
    console.log(out.name, "pm25", out.pm25 ?? "-", "pm10", out.pm10 ?? "-");
    if (out.pm25 !== undefined || out.pm10 !== undefined) stations.push(out);
  }

  const file: AirFile = {
    source: "GIOŚ — Główny Inspektorat Ochrony Środowiska (api.gios.gov.pl)",
    fetched: new Date().toISOString().slice(0, 10),
    note: "Mean of the hourly values available from the API (about the last 3 days), µg/m³.",
    stations,
  };
  mkdirSync("data/air", { recursive: true });
  writeFileSync("data/air/stations.json", JSON.stringify(file, null, 1) + "\n");
  console.log("wrote data/air/stations.json with", stations.length, "stations");
}
main();
