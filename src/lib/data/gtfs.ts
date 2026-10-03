import type { Poi } from "./osm";

// GTFS (ZTP Kraków) bus/tram stops with measured service frequency. Built by scripts/gtfs/build.ts.

export type GtfsStop = {
  id: string;
  name: string;
  at: [number, number];
  mode: "bus" | "tram";
  /** Average weekday departures per hour between 06:00 and 22:00. */
  departuresPerHour: number;
  /** Distinct lines serving the stop on that weekday. */
  routes: number;
};

export type GtfsFile = { source: string; serviceDate: string; window: string; stops: GtfsStop[] };

/** Departures/hour at which a stop counts as much as a typical OSM bus stop did (weight 1). */
const DEPARTURES_PER_UNIT = 4;
/** A single busy hub shouldn't outweigh a whole neighbourhood of regular stops. */
const MAX_DEPARTURES = 20;

/** Stop weight grows with real service: 4 departures/h ≈ 1, capped at 20 departures/h ≈ 5. */
export function gtfsStopWeight(departuresPerHour: number): number {
  return Math.min(departuresPerHour, MAX_DEPARTURES) / DEPARTURES_PER_UNIT;
}

export function gtfsToPois(file: GtfsFile): Poi[] {
  return file.stops.map((s) => ({
    category: "transport",
    kind: s.mode === "tram" ? "tram_stop" : "bus_stop",
    weight: gtfsStopWeight(s.departuresPerHour),
    name: s.name,
    at: s.at,
    departuresPerHour: s.departuresPerHour,
  }));
}
