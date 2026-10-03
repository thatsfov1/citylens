import assert from "node:assert/strict";
import { test } from "node:test";
import { AIR_REACH_M, airLevel, airScore, interpolateAir, type AirFile, type AirIndicator } from "../data/air";

const center: [number, number] = [19.9372, 50.0614];
const at = (m: number): { lng: number; lat: number } => ({ lng: center[0], lat: center[1] + m / 110574 });
const file = (stations: AirFile["stations"]): AirFile => ({ source: "test", fetched: "2026-10-03", note: "", stations });

test("a cell with no station in reach has no air data", () => {
  const far = file([{ id: 1, name: "far", ...at(AIR_REACH_M + 500), pm10: 30 }]);
  assert.equal(interpolateAir(center, far), null);
});

test("a single station gives its value, with the nearest station named", () => {
  const air = interpolateAir(center, file([{ id: 1, name: "A", ...at(1000), pm10: 30, pm25: 18 }]));
  assert.equal(air?.pm10, 30);
  assert.equal(air?.pm25, 18);
  assert.equal(air?.stations, 1);
  assert.equal(air?.nearest.name, "A");
  assert.ok(Math.abs((air?.nearest.distanceM ?? 0) - 1000) < 20); // my metres-per-degree is a planar approximation
  assert.equal(air?.asOf, "2026-10-03");
});

test("interpolation leans toward the closer station", () => {
  const air = interpolateAir(
    center,
    file([
      { id: 1, name: "near", ...at(500), pm10: 20 },
      { id: 2, name: "far", ...at(4000), pm10: 60 },
    ]),
  );
  assert.ok(air?.pm10 !== undefined && air.pm10 > 20 && air.pm10 < 30);
  assert.equal(air?.nearest.name, "near");
});

test("a pollutant only some stations measure is interpolated from those alone", () => {
  const air = interpolateAir(
    center,
    file([
      { id: 1, name: "A", ...at(500), pm10: 30 },
      { id: 2, name: "B", ...at(800), pm10: 40, pm25: 20 },
    ]),
  );
  assert.equal(air?.pm25, 20);
  assert.equal(air?.stations, 2);
});

test("interpolation is deterministic", () => {
  const f = file([
    { id: 1, name: "A", ...at(500), pm10: 31.4 },
    { id: 2, name: "B", ...at(2500), pm10: 22.9 },
  ]);
  assert.deepEqual(interpolateAir(center, f), interpolateAir(center, f));
});

test("cleaner air scores higher and the score stays within 0–100", () => {
  const ind = (pm10: number): AirIndicator => ({ pm10, stations: 1, nearest: { name: "A", distanceM: 1 }, asOf: "2026-10-03" });
  assert.equal(airScore(ind(10)), 100);
  assert.equal(airScore(ind(500)), 0);
  assert.ok(airScore(ind(25)) > airScore(ind(45)));
});

test("PM2.5 is used for the score only when PM10 is missing", () => {
  const base = { stations: 1, nearest: { name: "A", distanceM: 1 }, asOf: "2026-10-03" };
  assert.equal(airScore({ ...base, pm10: 15, pm25: 50 }), 100);
  assert.equal(airScore({ ...base, pm25: 50 }), 0);
});

test("air level follows the PM10 bands, falling back to PM2.5", () => {
  const base = { stations: 1, nearest: { name: "A", distanceM: 1 }, asOf: "2026-10-03" };
  assert.equal(airLevel({ ...base, pm10: 15 }), "good");
  assert.equal(airLevel({ ...base, pm10: 30 }), "normal");
  assert.equal(airLevel({ ...base, pm10: 45 }), "bad");
  assert.equal(airLevel({ ...base, pm10: 80 }), "bad");
  assert.equal(airLevel({ ...base, pm10: 300 }), "very bad");
  assert.equal(airLevel({ ...base, pm25: 15 }), "normal");
});
