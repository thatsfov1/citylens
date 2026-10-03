// Builds data/gtfs/timetable.json: a compact weekday-morning timetable of Kraków bus/tram lines, used to plan
// commutes (src/lib/data/transit.ts). Usage: npx tsx scripts/gtfs/build-timetable.ts [YYYYMMDD]
// Source: official ZTP Kraków GTFS feeds (https://gtfs.ztp.krakow.pl), downloaded to data/gtfs/full/ (gitignored).
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";

/** A normal weekday inside the feeds' published window (they list only a few weeks ahead). */
const SERVICE_DATE = process.argv[2] ?? "20261006";
/** Trips are kept when they leave their first stop in this window (seconds after midnight). */
const FROM_S = 6.5 * 3600;
const TO_S = 10.5 * 3600;

const FEEDS = [
  { mode: "bus", file: "GTFS_KRK_A" },
  { mode: "tram", file: "GTFS_KRK_T" },
  { mode: "bus", file: "GTFS_KRK_M" },
] as const;
const DIR = "data/gtfs/full";

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

const toSec = (t: string) => {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

type Stop = { name: string; at: [number, number] };
type Pattern = { line: string; mode: "bus" | "tram"; headsign: string; stops: number[]; offs: number[]; starts: number[] };

const stops: Stop[] = [];
const stopIndex = new Map<string, number>(); // "<feed letter>:<stop_id>" -> index into `stops`
const patterns = new Map<string, Pattern>();

async function processFeed(feed: (typeof FEEDS)[number]) {
  const dir = ensureFeed(feed.file);
  const letter = feed.file.slice(-1);

  const active = new Set<string>();
  for await (const r of rows(`${dir}/calendar_dates.txt`)) {
    if (r.date === SERVICE_DATE && r.exception_type === "1") active.add(r.service_id);
  }
  if (active.size === 0) throw new Error(`${feed.file}: no service on ${SERVICE_DATE} — pass a date inside the feed window`);

  const routeName = new Map<string, string>();
  for await (const r of rows(`${dir}/routes.txt`)) routeName.set(r.route_id, r.route_short_name || r.route_id);

  const trips = new Map<string, { line: string; headsign: string }>();
  for await (const t of rows(`${dir}/trips.txt`)) {
    if (active.has(t.service_id)) trips.set(t.trip_id, { line: routeName.get(t.route_id) ?? t.route_id, headsign: t.trip_headsign });
  }

  const feedStops = new Map<string, Stop>();
  for await (const s of rows(`${dir}/stops.txt`)) {
    const lat = Number(s.stop_lat);
    const lng = Number(s.stop_lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) feedStops.set(s.stop_id, { name: s.stop_name, at: [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] });
  }

  // Not every feed groups stop_times.txt by trip (Mobilis interleaves them), so collect per trip and sort by sequence.
  const byTrip = new Map<string, { seq: number; stop: string; arr: number; dep: number }[]>();
  for await (const st of rows(`${dir}/stop_times.txt`)) {
    if (!trips.has(st.trip_id)) continue;
    const list = byTrip.get(st.trip_id) ?? [];
    list.push({ seq: Number(st.stop_sequence), stop: st.stop_id, arr: toSec(st.arrival_time), dep: toSec(st.departure_time) });
    byTrip.set(st.trip_id, list);
  }
  for (const [tripId, unsorted] of byTrip) {
    const trip = trips.get(tripId)!;
    const current = unsorted.sort((a, b) => a.seq - b.seq);
    if (current.length < 2) continue;
    const start = current[0].dep;
    if (start < FROM_S || start > TO_S) continue;
    const ids = current.map((c) => {
      const key = `${letter}:${c.stop}`;
      let idx = stopIndex.get(key);
      if (idx === undefined) {
        const s = feedStops.get(c.stop);
        if (!s) return -1;
        idx = stops.push(s) - 1;
        stopIndex.set(key, idx);
      }
      return idx;
    });
    if (ids.includes(-1)) continue;
    // Offsets: arrival at each stop relative to the first departure.
    const offs = current.map((c, i) => (i === 0 ? 0 : c.arr - start));
    const key = `${feed.mode}|${trip.line}|${trip.headsign}|${ids.join(",")}|${offs.join(",")}`;
    const p = patterns.get(key) ?? { line: trip.line, mode: feed.mode, headsign: trip.headsign, stops: ids, offs, starts: [] };
    p.starts.push(start);
    patterns.set(key, p);
  }
}

async function main() {
  for (const f of FEEDS) {
    await processFeed(f);
    console.log(f.file, "→", patterns.size, "patterns so far,", stops.length, "stops");
  }
  const list = [...patterns.values()].map((p) => ({ ...p, starts: p.starts.sort((a, b) => a - b) }));
  mkdirSync("data/gtfs", { recursive: true });
  writeFileSync(
    "data/gtfs/timetable.json",
    JSON.stringify({
      source: "ZTP Kraków GTFS (gtfs.ztp.krakow.pl)",
      serviceDate: SERVICE_DATE,
      window: "06:30–10:30 departures",
      stops: stops.map((s) => [s.name, ...s.at]),
      patterns: list.map((p) => [p.line, p.mode === "tram" ? 1 : 0, p.headsign, p.stops, p.offs, p.starts]),
    }) + "\n",
  );
  console.log("wrote data/gtfs/timetable.json:", stops.length, "stops,", list.length, "patterns,", list.reduce((n, p) => n + p.starts.length, 0), "trips");
}
main();
