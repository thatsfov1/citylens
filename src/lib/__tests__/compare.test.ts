import assert from "node:assert/strict";
import { test } from "node:test";
import { compareAreas } from "../scoring/compare";
import type { CategoryWeights, HexData } from "../../types";

const w: CategoryWeights = { sport: 0, culture: 0, greenery: 0.7, shopping: 0, transport: 0.3, education: 0 };
const mk = (id: string, greenery: number, transport: number, district?: string): HexData => ({
  h3Index: id,
  district,
  scores: { sport: 10, culture: 10, greenery, shopping: 10, transport, education: 10 },
});
const hexes = [mk("a", 90, 20, "Podgórze"), mk("b", 40, 80), mk("c", 40, 80)];

test("compareAreas: matches, leaders and rows ordered by weight", () => {
  const c = compareAreas(hexes, ["a", "b"], w);
  assert.deepEqual(c.areas.map((a) => a.match), [69, 52]);
  assert.deepEqual(c.matchLeads, [true, false]);
  assert.equal(c.rows[0].category, "greenery");
  assert.deepEqual(c.rows[0].leads, [true, false]);
  assert.deepEqual(c.rows[1].leads, [false, true]);
  assert.equal(c.areas[0].district, "Podgórze");
});

test("compareAreas: no leader on ties, unknown ids skipped", () => {
  const c = compareAreas(hexes, ["b", "c", "zzz"], w);
  assert.equal(c.areas.length, 2);
  assert.deepEqual(c.matchLeads, [false, false]);
  assert.deepEqual(c.rows[0].leads, [false, false]);
});
