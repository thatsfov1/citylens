// Builds data/gtfs/stops.json: every Kraków bus/tram stop with how often it is served.
// Usage: npx tsx scripts/gtfs/build.ts
// Source: official ZTP Kraków GTFS feeds (https://gtfs.ztp.krakow.pl), downloaded to data/gtfs/full/ (gitignored).
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";

/** A normal Tuesday: both feeds list it with their regular weekday service. */
const SERVICE_DATE = "20261006";
/** Departures are counted between these hours (local time) and averaged per hour. */
const FROM_H = 6;
const TO_H = 22;

// A = MPK buses, T = MPK trams, M = Mobilis (suburban lines operated for the city, e.g. Branice, Karowa).
const FEEDS = [
  { mode: "bus", file: "GTFS_KRK_A" },
  { mode: "tram", file: "GTFS_KRK_T" },
  { mode: "bus", file: "GTFS_KRK_M" },
] as const;

const DIR = "data/gtfs/full";

/** Minimal CSV line parser (handles quoted fields and "" escapes). */
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function* rows(path: string): AsyncGenerator<Record<string, string>> {
  let header: string[] | null = null;
  for await (const raw of createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity })) {
    const line = raw.replace(/^﻿/, "");
    if (!line) continue;
    const cells = parseLine(line);
    if (!header) header = cells;
    else yield Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  }
}

function ensureFeed(file: string) {
  const dir = `${DIR}/${file}`;
  if (existsSync(`${dir}/stop_times.txt`)) return dir;
  mkdirSync(dir, { recursive: true });
  const zip = `${DIR}/${file}.zip`;
  console.log(`downloading ${file}…`);
  execFileSync("curl", ["-sfL", "-o", zip, `https://gtfs.ztp.krakow.pl/${file}.zip`]);
  execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
  return dir;
}

type Stop = { id: string; name: string; at: [number, number]; mode: "bus" | "tram"; departures: number; routes: Set<string> };

async function processFeed(feed: (typeof FEEDS)[number]): Promise<Stop[]> {
  const dir = ensureFeed(feed.file);

  // The feeds list service only in calendar_dates.txt (weekday flags in calendar.txt are all 0),
  // so the services running on SERVICE_DATE are the ones with an "added" (1) exception that day.
  const active = new Set<string>();
  for await (const r of rows(`${dir}/calendar_dates.txt`)) {
    if (r.date === SERVICE_DATE && r.exception_type === "1") active.add(r.service_id);
  }
  if (active.size === 0) throw new Error(`${feed.file}: no service on ${SERVICE_DATE} — update SERVICE_DATE`);

  const tripRoute = new Map<string, string>();
  for await (const t of rows(`${dir}/trips.txt`)) if (active.has(t.service_id)) tripRoute.set(t.trip_id, t.route_id);

  const routeName = new Map<string, string>();
  for await (const r of rows(`${dir}/routes.txt`)) routeName.set(r.route_id, r.route_short_name || r.route_id);

  const stops = new Map<string, Stop>();
  for await (const s of rows(`${dir}/stops.txt`)) {
    if (s.location_type && s.location_type !== "0") continue;
    const lat = Number(s.stop_lat);
    const lng = Number(s.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    stops.set(s.stop_id, { id: `${feed.file.slice(-1)}:${s.stop_id}`, name: s.stop_name, at: [lng, lat], mode: feed.mode, departures: 0, routes: new Set() });
  }

  for await (const st of rows(`${dir}/stop_times.txt`)) {
    const route = tripRoute.get(st.trip_id);
    if (!route || st.pickup_type === "1") continue; // other day's trip, or alighting-only (e.g. last stop)
    const stop = stops.get(st.stop_id);
    if (!stop) continue;
    const h = Number(st.departure_time.slice(0, 2));
    if (h < FROM_H || h >= TO_H) continue;
    stop.departures++;
    stop.routes.add(routeName.get(route) ?? route);
  }
  return [...stops.values()];
}

async function main() {
  const all: Stop[] = [];
  for (const f of FEEDS) {
    const s = await processFeed(f);
    console.log(f.file, s.length, "stops,", s.filter((x) => x.departures > 0).length, "with service");
    all.push(...s);
  }
  const hours = TO_H - FROM_H;
  const out = all
    .filter((s) => s.departures > 0)
    .map((s) => ({
      id: s.id,
      name: s.name,
      at: s.at.map((v) => Math.round(v * 1e6) / 1e6),
      mode: s.mode,
      departuresPerHour: Math.round((s.departures / hours) * 10) / 10,
      routes: s.routes.size,
    }));
  mkdirSync("data/gtfs", { recursive: true });
  writeFileSync(
    "data/gtfs/stops.json",
    JSON.stringify({ source: "ZTP Kraków GTFS (gtfs.ztp.krakow.pl)", serviceDate: SERVICE_DATE, window: `${FROM_H}:00–${TO_H}:00`, stops: out }) + "\n",
  );
  const dph = out.map((s) => s.departuresPerHour).sort((a, b) => a - b);
  const q = (p: number) => dph[Math.floor(p * (dph.length - 1))];
  console.log("wrote data/gtfs/stops.json:", out.length, "stops; departures/hour p10/p50/p90/max =", q(0.1), q(0.5), q(0.9), dph[dph.length - 1]);
}
main();
