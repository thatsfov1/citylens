import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { latLngToCell } from "h3-js";
import { HEALTH_KINDS, HEALTH_WEIGHTS, combineHealth, scoreHealth, type HealthFeaturesFile, type HealthIndicators } from "../data/health";
import { describeHealthParts } from "../scoring/facts";
import type { HexIndicators } from "../../types";

const center: [number, number] = [19.9372, 50.0614];
const at = (m: number): [number, number] => [center[0], center[1] + m / 110574];
const file = (pts: [[number, number], (typeof HEALTH_KINDS)[number]][]): HealthFeaturesFile => ({
  source: "test",
  fetched: "2026-10-03",
  kinds: [...HEALTH_KINDS],
  points: pts.map(([p, k]) => [p[0], p[1], HEALTH_KINDS.indexOf(k)]),
});

test("weights add up to 1", () => {
  assert.ok(Math.abs(Object.values(HEALTH_WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test("nearby places count with the distance bands; far ones do not", () => {
  const h = scoreHealth(center, file([[at(100), "pharmacy"], [at(400), "pharmacy"], [at(900), "pharmacy"], [at(1500), "pharmacy"]]));
  assert.equal(h.pharmacy.raw, 1 + 0.6 + 0.25);
  assert.equal(h.pharmacy.within500, 2);
  assert.equal(h.pharmacy.within1000, 3);
  assert.ok(Math.abs((h.pharmacy.nearestM ?? 0) - 100) < 5);
  assert.equal(h.doctor.nearestM, null);
});

test("a hospital is counted up to 3 km, with the bands stretched", () => {
  const h = scoreHealth(center, file([[at(600), "hospital"], [at(2000), "hospital"], [at(3500), "hospital"]]));
  assert.equal(h.hospital.raw, 1 + 0.25); // 600 m is inside the full band (0-750 m), 2 km in the last (1.5-3 km)
  assert.equal(h.hospital.within1000, 1);
});

test("combineHealth is the weighted mean of the per-kind scores", () => {
  const all = (v: number) => Object.fromEntries(HEALTH_KINDS.map((k) => [k, v])) as Record<(typeof HEALTH_KINDS)[number], number>;
  assert.equal(combineHealth(all(80)), 80);
  assert.equal(combineHealth({ ...all(0), pharmacy: 100 }), 30);
});

test("the panel text names what is nearby, and what is missing", () => {
  const h = scoreHealth(center, file([[at(180), "pharmacy"], [at(300), "pharmacy"]])) as HealthIndicators;
  h.pharmacy.score = 90;
  const parts = describeHealthParts({ health: h } as unknown as HexIndicators);
  assert.equal(parts.length, 5);
  assert.match(parts[0].fact, /Najbliższa apteka: 180 m · w promieniu 1 km: 2/);
  assert.equal(parts[0].score, 90);
  assert.match(parts[2].fact, /Brak szpitala w promieniu 3,0 km/);
  assert.equal(parts[0].sharePct, 30);
});

test("the committed OSM extract has a plausible number of places, and the old town is well served", () => {
  const f = JSON.parse(readFileSync("data/health/features.json", "utf8")) as HealthFeaturesFile;
  const n = (k: string) => f.points.filter((p) => f.kinds[p[2]] === k).length;
  assert.ok(n("pharmacy") > 200 && n("doctor") > 200 && n("hospital") >= 10 && n("post") > 80 && n("bank") > 80);
  const rynek = scoreHealth(center, f);
  assert.ok(rynek.pharmacy.within500 >= 3 && rynek.doctor.within500 >= 3, "Rynek has pharmacies and doctors within 500 m");
  const forest = scoreHealth([19.865, 50.054], f); // Las Wolski
  assert.ok(forest.pharmacy.raw < rynek.pharmacy.raw);
  assert.equal(latLngToCell(center[1], center[0], 8).length, 15);
});
