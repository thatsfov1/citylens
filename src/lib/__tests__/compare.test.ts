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
  assert.equal(c.rows[0].category, "greenery"); // weight 0.7 × spread 50 beats transport 0.3 × 60
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

test("compareAreas: summary names the leader and the category behind the lead; close matches declare no winner", () => {
  const c = compareAreas(hexes, ["a", "b"], w);
  assert.deepEqual(c.summary, { kind: "leader", index: 0, gap: 17, driver: "greenery" });
  assert.deepEqual(compareAreas(hexes, ["b", "c"], w).summary, { kind: "close" });
  assert.equal(compareAreas(hexes, ["a"], w).summary, null);
});

test("compareAreas: rows with zero weight sink below the rows that matter, even with a big spread", () => {
  const c = compareAreas([mk("a", 50, 50), { ...mk("b", 50, 50), scores: { sport: 100, culture: 10, greenery: 50, shopping: 10, transport: 50, education: 10 } }], ["a", "b"], w);
  assert.notEqual(c.rows[0].category, "sport");
});

test("compareAreas: areas sharing a district get numbered labels", () => {
  const c = compareAreas([mk("a", 1, 1, "Podgórze"), mk("b", 2, 2, "Podgórze"), mk("c", 3, 3, "Czyżyny")], ["a", "b", "c"], w);
  assert.deepEqual(c.areas.map((a) => a.label), ["Podgórze 1", "Podgórze 2", "Czyżyny"]);
});
