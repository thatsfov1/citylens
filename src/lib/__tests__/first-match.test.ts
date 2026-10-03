import assert from "node:assert/strict";
import { test } from "node:test";
import { strongestAreas, topContributor } from "../scoring/first-match";
import type { CategoryWeights, HexData } from "../../types";

const weights: CategoryWeights = { sport: 0, culture: 0, greenery: 1, shopping: 0, transport: 0, education: 0 };
const mk = (id: string, greenery: number, safety?: number): HexData => ({
  h3Index: id,
  scores: { sport: 0, culture: 0, greenery, shopping: 0, transport: 0, education: 0 },
  safety,
});
const hexes = Array.from({ length: 20 }, (_, i) => mk(`h${String(i).padStart(2, "0")}`, i * 5));

test("strongestAreas: top 10% by personal score, best first", () => {
  assert.deepEqual(strongestAreas(hexes, weights), ["h19", "h18"]);
});

test("strongestAreas: ties break by h3 index", () => {
  const tied = [mk("b", 50), mk("a", 50), mk("c", 10)];
  assert.deepEqual(strongestAreas(tied, weights), ["a"]);
});

test("strongestAreas: skips cells below the minimum safety, keeps cells without data", () => {
  const list = [...hexes.slice(0, 18), mk("x1", 100, 10), mk("x2", 95)];
  assert.deepEqual(strongestAreas(list, weights, 50), ["x2", "h17"]);
});

test("topContributor: nearest place of the highest-weighted category that has one", () => {
  const places = {
    places: [
      { id: 1, category: "sport", kind: "pitch", name: "A", lng: 0, lat: 0, distanceM: 400 },
      { id: 2, category: "sport", kind: "pitch", name: "B", lng: 0, lat: 0, distanceM: 200 },
      { id: 3, category: "culture", kind: "museum", name: "M", lng: 0, lat: 0, distanceM: 50 },
    ],
    green: { type: "FeatureCollection", features: [] },
  } as import("../../types").PlacesResponse;
  const w = { sport: 0.3, culture: 0.1, greenery: 0.6, shopping: 0, transport: 0, education: 0 };
  const c = topContributor(places, w); // greenery has none -> falls through to sport
  assert.ok(c && c.category === "sport" && c.place.id === 2);
  assert.equal(topContributor({ places: [], green: places.green }, w), null);
});
