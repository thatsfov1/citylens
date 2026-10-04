import type { AirFile, AirStation } from "./air";

// Reads PM2.5 / PM10 for Kraków's stations from the public GIOŚ API (https://api.gios.gov.pl, no key). Shared by
// scripts/air/build-air.ts (offline snapshot) and GET /api/air (live). The API only serves the last ~3 days of
// hourly values, and answers 400 for manual (non-live) sensors, which simply have no data here.

const API = "https://api.gios.gov.pl/pjp-api/v1/rest";

export type GiosOptions = {
  /** Mean of the newest N valid hourly values; null = everything the API serves (about 3 days). */
  windowHours: number | null;
  /** Fewer valid hourly values than this → not representative, the sensor is skipped. */
  minHours: number;
  /** Attempts per request (1 = no retry). */
  attempts: number;
  timeoutMs: number;
  fetchFn?: typeof fetch;
};

type RawStation = Record<string, string | number>;
type RawSensor = Record<string, string | number>;
type Reading = { Data: string; Wartość: number | null };
type RawData = { "Lista danych pomiarowych": Reading[] };

/** Mean of the newest `windowHours` valid readings (all if null) and the newest timestamp; null if too few. */
export function newestMean(
  rows: Reading[],
  windowHours: number | null,
  minHours: number,
): { mean: number; hours: number; latest: string } | null {
  const valid = rows
    .filter((r): r is { Data: string; Wartość: number } => r.Wartość !== null)
    .sort((a, b) => (a.Data < b.Data ? 1 : a.Data > b.Data ? -1 : 0)); // newest first; timestamps sort as text
  const used = windowHours === null ? valid : valid.slice(0, windowHours);
  if (used.length < minHours) return null;
  const mean = used.reduce((s, r) => s + r.Wartość, 0) / used.length;
  return { mean, hours: used.length, latest: used[0].Data };
}

/** Parsed JSON; null on a 400 (manual sensors). Throws once the attempts are used up. */
async function get<T>(path: string, o: GiosOptions): Promise<T | null> {
  const doFetch = o.fetchFn ?? fetch;
  let last: unknown;
  for (let attempt = 0; attempt < o.attempts; attempt++) {
    try {
      const res = await doFetch(`${API}/${path}`, { signal: AbortSignal.timeout(o.timeoutMs) });
      if (res.status === 400) return null;
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as T;
    } catch (e) {
      last = e;
      if (attempt + 1 < o.attempts) await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
    }
  }
  throw new Error(`GIOŚ ${path} failed: ${String(last)}`);
}

async function station(s: RawStation, o: GiosOptions): Promise<AirStation | null> {
  const id = s["Identyfikator stacji"] as number;
  const list = await get<Record<string, RawSensor[]>>(`station/sensors/${id}`, o);
  const sensors = list?.["Lista stanowisk pomiarowych dla podanej stacji"] ?? [];
  const out: AirStation = {
    id,
    name: String(s["Nazwa stacji"]).replace(/^Kraków,\s*/, ""),
    lng: Number(s["WGS84 λ E"]),
    lat: Number(s["WGS84 φ N"]),
  };
  for (const [key, code] of [["pm25", "PM2.5"], ["pm10", "PM10"]] as const) {
    const sensor = sensors.find((x) => x["Wskaźnik - kod"] === code);
    if (!sensor) continue;
    const data = await get<RawData>(`data/getData/${sensor["Identyfikator stanowiska"]}?size=500&dayNumber=30`, o);
    const m = data && newestMean(data["Lista danych pomiarowych"], o.windowHours, o.minHours);
    if (m) {
      out[key] = Math.round(m.mean * 10) / 10;
      out.asOf = !out.asOf || m.latest > out.asOf ? m.latest : out.asOf;
    }
  }
  return out.pm25 !== undefined || out.pm10 !== undefined ? out : null;
}

/** Stations in Kraków with their PM means. Throws if the station list itself is unavailable. */
export async function fetchGiosStations(o: GiosOptions): Promise<AirFile> {
  const all = await get<Record<string, RawStation[]>>("station/findAll?size=500&page=0", o);
  if (!all) throw new Error("GIOŚ station list unavailable");
  const krakow = all["Lista stacji pomiarowych"].filter((s) => s["Nazwa miasta"] === "Kraków");
  const found = await Promise.all(krakow.map((s) => station(s, o)));
  return {
    source: "GIOŚ — Główny Inspektorat Ochrony Środowiska (api.gios.gov.pl)",
    fetched: new Date().toISOString().slice(0, 10),
    note:
      o.windowHours === null
        ? "Mean of the hourly values available from the API (about the last 3 days), µg/m³."
        : `Mean of the newest ${o.windowHours} hourly values, µg/m³.`,
    ...(o.windowHours === null ? {} : { windowHours: o.windowHours }),
    stations: found.filter((s): s is AirStation => s !== null),
  };
}
