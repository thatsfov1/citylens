import assert from "node:assert/strict";
import { test } from "node:test";
import { RENT_MAX, RENT_MIN, budgetToFilter, classifyHexes, formatRentRange, rentFit, rentFor, rentFromQuery, rentToQuery } from "../scoring/rent";

const stats = (median: number) => ({ n: 20, p25: median - 200, median, p75: median + 200 });
const table = { A: { "2": stats(3000) }, B: { "2": stats(2000) }, C: {} };

test("rent fits when the median is inside the range, inclusive", () => {
  const f = { min: 2500, max: 3500, rooms: 2 as const };
  assert.equal(rentFit(stats(3000), f), "in");
  assert.equal(rentFit(stats(2500), f), "in");
  assert.equal(rentFit(stats(2400), f), "out");
  assert.equal(rentFit(stats(3600), f), "out");
});

test("handles at the extremes mean no limit on that side", () => {
  assert.equal(rentFit(stats(1000), { min: RENT_MIN, max: 3000, rooms: 2 }), "in");
  assert.equal(rentFit(stats(9000), { min: 2000, max: RENT_MAX, rooms: 2 }), "in");
});

test("missing stats are unknown, never in or out", () => {
  assert.equal(rentFit(null, { min: 2000, max: 3000, rooms: 2 }), "unknown");
  assert.equal(rentFor(null, 2, table), null);
  assert.equal(rentFor("C", 2, table), null);
});

test("classifyHexes groups hexes by their district", () => {
  const hexes = [
    { h3Index: "1", district: "A" },
    { h3Index: "2", district: "B" },
    { h3Index: "3", district: "C" },
    { h3Index: "4", district: null },
  ];
  const { over, unknown } = classifyHexes(hexes, { min: 2500, max: 3500, rooms: 2 }, table);
  assert.deepEqual([...over], ["2"]);
  assert.deepEqual([...unknown].sort(), ["3", "4"]);
});

test("query round trip, and invalid or unbounded values are ignored", () => {
  const f = { min: 2500, max: 4000, rooms: 3 as const };
  const q = Object.fromEntries(new URLSearchParams(rentToQuery(f)));
  assert.deepEqual(rentFromQuery(q), f);
  assert.equal(rentFromQuery({ rent: "4000-2500" }), null);
  assert.equal(rentFromQuery({ rent: "abc" }), null);
  assert.equal(rentFromQuery({ rent: "2500-4000", rooms: "9" }), null);
  assert.equal(rentFromQuery({ rent: `${RENT_MIN}-${RENT_MAX}` }), null);
  assert.deepEqual(rentFromQuery({ rent: "2500-4000" }), { min: 2500, max: 4000, rooms: 2 });
});

test("range text", () => {
  assert.equal(formatRentRange({ min: RENT_MIN, max: 3000 }), "up to 3 000 zł");
  assert.equal(formatRentRange({ min: 2500, max: RENT_MAX }), "from 2 500 zł");
  assert.equal(formatRentRange({ min: RENT_MIN, max: RENT_MAX }), "any rent");
});

test("a stated budget becomes a valid filter, snapped to the slider step", () => {
  assert.deepEqual(budgetToFilter({ min: null, max: 3540, rooms: null }), { min: RENT_MIN, max: 3500, rooms: 2 });
  assert.deepEqual(budgetToFilter({ min: 2000, max: 3000, rooms: 1 }), { min: 2000, max: 3000, rooms: 1 });
  assert.deepEqual(budgetToFilter({ min: 2000, max: null, rooms: 3 }), { min: 2000, max: RENT_MAX, rooms: 3 });
  assert.deepEqual(budgetToFilter({ min: 100, max: 99999, rooms: null }), null);
  assert.equal(budgetToFilter({ min: 4000, max: 2000, rooms: null }), null);
  assert.equal(budgetToFilter({ min: null, max: null, rooms: 2 }), null);
  assert.equal(budgetToFilter(null), null);
});
