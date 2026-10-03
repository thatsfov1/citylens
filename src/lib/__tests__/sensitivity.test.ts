import assert from "node:assert/strict";
import { test } from "node:test";
import { computeSensitivity } from "../scoring/sensitivity";
import type { HexData } from "../../types";
import type { Importance } from "../scoring/preferences";

const zero: Importance = { sport: 0, culture: 0, greenery: 0, shopping: 0, transport: 0, education: 0 };
const mk = (id: string, greenery: number, transport: number): HexData => ({
  h3Index: id,
  scores: { sport: 0, culture: 0, greenery, shopping: 0, transport, education: 0 },
});

// 20 cells; greenery and transport rise together (i), plus one cell that is green but has no transport.
const hexes = [
  ...Array.from({ length: 20 }, (_, i) => mk(`h${String(i).padStart(2, "0")}`, i * 5, i * 5)),
  mk("green-only", 100, 0),
];

test("a cell on top in every category is stable", () => {
  const s = computeSensitivity(hexes, "h19", { ...zero, greenery: 50, transport: 50 });
  assert.ok(s);
  assert.equal(s.baseBand, 4);
  assert.equal(s.stable, true);
  assert.deepEqual(s.fragile, []);
});

test("a cell that is top only through greenery is fragile and names the category", () => {
  const s = computeSensitivity(hexes, "green-only", { ...zero, greenery: 50, transport: 25 });
  assert.ok(s);
  assert.equal(s.stable, false);
  assert.ok(s.fragile.some((n) => n.category === "transport" && n.direction === "more" && n.band < s.baseBand));
});

test("clamped nudges are skipped; all-zero importance and unknown cells give null", () => {
  const s = computeSensitivity(hexes, "h19", { ...zero, greenery: 100 });
  assert.ok(s);
  assert.ok(!s.fragile.some((n) => n.category === "greenery" && n.direction === "more"));
  assert.equal(computeSensitivity(hexes, "h19", zero), null);
  assert.equal(computeSensitivity(hexes, "nope", { ...zero, greenery: 50 }), null);
});
