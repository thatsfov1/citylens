import assert from "node:assert/strict";
import { test } from "node:test";
import { cellToLatLng } from "h3-js";
import { getDemoCells } from "../h3/grid";
import { getMockScores } from "../mock-data/mock-scores";
import { calculatePersonalScore } from "../scoring/personal-score";
import { explainMatch } from "../scoring/explain";
import { normalizeWeights } from "../scoring/weights";
import { CATEGORIES } from "../../types";

test("mock scores are deterministic and within 0–100", () => {
  const cells = getDemoCells().slice(0, 200);
  for (const cell of cells) {
    const a = getMockScores(cell);
    assert.deepEqual(a, getMockScores(cell));
    for (const c of CATEGORIES) {
      assert.ok(Number.isInteger(a[c]) && a[c] >= 0 && a[c] <= 100);
    }
  }
});

test("demo grid has a sensible number of cells", () => {
  const n = getDemoCells().length;
  assert.ok(n > 200 && n < 2000, `got ${n}`);
});

test("normalizeWeights sums to 1, and handles all-zero", () => {
  const w = normalizeWeights({ sport: 50, culture: 10, greenery: 70, shopping: 20, transport: 50, education: 20 });
  assert.ok(Math.abs(CATEGORIES.reduce((s, c) => s + w[c], 0) - 1) < 1e-9);
  const z = normalizeWeights({ sport: 0, culture: 0, greenery: 0, shopping: 0, transport: 0, education: 0 });
  assert.ok(Math.abs(z.sport - 1 / 6) < 1e-9);
});

test("personal score is the weighted sum", () => {
  const scores = { sport: 100, culture: 0, greenery: 50, shopping: 0, transport: 0, education: 0 };
  const weights = { sport: 0.5, culture: 0, greenery: 0.5, shopping: 0, transport: 0, education: 0 };
  assert.equal(calculatePersonalScore(scores, weights), 75);
});

test("explanation reflects priorities and weak spots", () => {
  const scores = { sport: 80, culture: 20, greenery: 91, shopping: 67, transport: 88, education: 50 };
  const weights = { sport: 0.25, culture: 0.3, greenery: 0.2, shopping: 0.05, transport: 0.2, education: 0 };
  const ex = explainMatch(scores, weights);
  assert.ok(ex.reasons.length > 0);
  assert.ok(ex.considerations.some((c) => c.includes("kultura")));
});

test("percentileRanks spans 0–1 and handles ties", async () => {
  const { percentileRanks } = await import("../scoring/percentile");
  assert.deepEqual(percentileRanks([10, 20, 30]), [0, 0.5, 1]);
  assert.deepEqual(percentileRanks([5, 5, 5]), [0.5, 0.5, 0.5]);
});

test("every demo cell lies in Kraków's bounding region", () => {
  for (const cell of getDemoCells()) {
    const [lat, lng] = cellToLatLng(cell);
    assert.ok(lat > 49.9 && lat < 50.2 && lng > 19.7 && lng < 20.3);
  }
});
