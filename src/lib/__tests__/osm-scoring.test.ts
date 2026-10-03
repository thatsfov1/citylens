import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleRings, haversine, pointInPolygon, type Ring } from "../data/geo";
import { classifyPoi, parseGreen, ringAreaM2, type GreenArea, type Poi } from "../data/osm";
import { distanceWeight, findDistrict, normalizeRaw, scoreGreenery, scorePoiCategory } from "../data/score-hex";

const center: [number, number] = [19.9372, 50.0614];
// ~111 m per 0.001° lat
const north = (m: number): [number, number] => [center[0], center[1] + m / 110574];

test("distance bands", () => {
  assert.equal(distanceWeight(100), 1);
  assert.equal(distanceWeight(400), 0.6);
  assert.equal(distanceWeight(900), 0.25);
  assert.equal(distanceWeight(1500), 0);
});

test("haversine ~ 111 km per degree latitude", () => {
  const d = haversine([19, 50], [19, 51]);
  assert.ok(Math.abs(d - 111195) < 200);
});

test("classifyPoi maps OSM tags to categories", () => {
  assert.equal(classifyPoi({ tourism: "museum" })?.category, "culture");
  assert.equal(classifyPoi({ shop: "bakery" })?.category, "shopping");
  assert.equal(classifyPoi({ highway: "bus_stop" })?.category, "transport");
  assert.equal(classifyPoi({ leisure: "pitch" })?.category, "sport");
  assert.equal(classifyPoi({ amenity: "bench" }), null);
});

test("poi scoring decays with distance and ignores far features", () => {
  const mk = (m: number): Poi => ({ category: "shopping", kind: "supermarket", weight: 2, name: `s${m}`, at: north(m) });
  const near = scorePoiCategory(center, [mk(100)]);
  const mid = scorePoiCategory(center, [mk(400)]);
  const far = scorePoiCategory(center, [mk(2000)]);
  assert.ok(near.raw > mid.raw && mid.raw > far.raw);
  assert.equal(far.raw, 0);
  assert.equal(far.nearest, null);
  assert.equal(near.nearest?.name, "s100");
});

test("scoring is deterministic", () => {
  const pois: Poi[] = [{ category: "culture", kind: "museum", weight: 1.5, name: "M", at: north(300) }];
  assert.deepEqual(scorePoiCategory(center, pois), scorePoiCategory(center, pois));
});

function square(c: [number, number], halfM: number): Ring {
  const dy = halfM / 110574;
  const dx = halfM / (111320 * Math.cos((c[1] * Math.PI) / 180));
  return [[c[0] - dx, c[1] - dy], [c[0] + dx, c[1] - dy], [c[0] + dx, c[1] + dy], [c[0] - dx, c[1] + dy], [c[0] - dx, c[1] - dy]];
}

test("ringAreaM2 of a 200 m square", () => {
  assert.ok(Math.abs(ringAreaM2(square(center, 100)) - 40000) < 400);
});

test("greenery: inside a big park beats having none", () => {
  const ring = square(center, 400);
  const park: GreenArea = { name: "Park", polygons: [[ring]], bbox: [ring[0][0], ring[0][1], ring[2][0], ring[2][1]], areaM2: ringAreaM2(ring) };
  const inside = scoreGreenery(center, [park]);
  const none = scoreGreenery(center, []);
  assert.equal(inside.nearestPark?.distanceM, 0);
  assert.ok(inside.coverShare > 0.5);
  assert.ok(inside.raw > none.raw);
  assert.equal(none.nearestPark, null);
});

test("assembleRings joins segments and parseGreen handles relations", () => {
  const a: Ring = [[0, 0], [1, 0], [1, 1]];
  const b: Ring = [[1, 1], [0, 1], [0, 0]];
  assert.equal(assembleRings([a, b]).length, 1);
  const g = parseGreen([
    {
      type: "relation",
      id: 1,
      tags: { leisure: "park", name: "R" },
      members: [
        { type: "way", role: "outer", geometry: a.map(([lon, lat]) => ({ lat, lon })) },
        { type: "way", role: "outer", geometry: b.map(([lon, lat]) => ({ lat, lon })) },
      ],
    },
  ]);
  assert.equal(g.length, 1);
  assert.ok(pointInPolygon([0.5, 0.5], g[0].polygons[0]));
});

test("findDistrict: containment, with nearest-boundary fallback", () => {
  const ring = square(center, 500);
  const d = [{ name: "Centrum", polygons: [[ring]], bbox: [ring[0][0], ring[0][1], ring[2][0], ring[2][1]] as [number, number, number, number] }];
  assert.equal(findDistrict(center, d), "Centrum");
  assert.equal(findDistrict(north(900), d), "Centrum");
});

test("normalizeRaw is monotonic, bounded and handles all-zero", () => {
  const out = normalizeRaw([0, 1, 2, 5, 10, 100]);
  assert.deepEqual(out, [...out].sort((a, b) => a - b));
  assert.ok(out.every((v) => v >= 0 && v <= 100));
  assert.deepEqual(normalizeRaw([0, 0, 0]), [0, 0, 0]);
});
