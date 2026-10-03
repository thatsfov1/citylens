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
  assert.ok(ex.considerations.some((c) => c.startsWith("Culture")));
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

import { createScorer } from "../scoring/personal-score";
import { avoidFromQuery, avoidToQuery } from "../scoring/preferences";

const mkScores = (o: Partial<Record<(typeof CATEGORIES)[number], number>>) => ({ sport: 50, culture: 50, greenery: 50, shopping: 50, transport: 50, education: 50, ...o });

test("createScorer: a category every hex maxes out can't decide on its own", () => {
  // Transport is saturated (95–100) while greenery varies widely, so a greenery-heavy user prefers the edge.
  const centre = { scores: mkScores({ transport: 100, greenery: 40 }) };
  const edge = { scores: mkScores({ transport: 95, greenery: 90 }) };
  const filler = [60, 70, 80].map((g) => ({ scores: mkScores({ transport: 97, greenery: g }) }));
  const w = normalizeWeights({ sport: 0, culture: 0, greenery: 75, shopping: 0, transport: 25, education: 0 });
  const score = createScorer([centre, edge, ...filler], w);
  assert.ok(score(edge.scores) > score(centre.scores));
});

test("createScorer: avoided categories count in reverse, and the result stays within 0–100", () => {
  const busy = { scores: mkScores({ shopping: 95 }) };
  const quiet = { scores: mkScores({ shopping: 5 }) };
  const w = normalizeWeights({ sport: 0, culture: 0, greenery: 0, shopping: 100, transport: 0, education: 0 });
  const hexes = [busy, quiet, { scores: mkScores({ shopping: 50 }) }];
  const normal = createScorer(hexes, w);
  const less = createScorer(hexes, w, new Set(["shopping"] as const));
  assert.ok(normal(busy.scores) > normal(quiet.scores));
  assert.ok(less(quiet.scores) > less(busy.scores));
  for (const h of hexes) assert.ok(less(h.scores) >= 0 && less(h.scores) <= 100);
  assert.equal(Math.round(normal(hexes[2].scores)), 50);
});

test("avoid survives a query round trip and ignores junk", () => {
  assert.equal(avoidToQuery(new Set()), null);
  assert.equal(avoidToQuery(new Set(["shopping", "culture"] as const)), "culture,shopping");
  assert.deepEqual([...avoidFromQuery("shopping,bogus,culture")], ["culture", "shopping"]);
  assert.equal(avoidFromQuery(undefined).size, 0);
});

test("explainMatch: wanting less of a category turns a high score into a consideration", () => {
  const w = normalizeWeights({ sport: 0, culture: 0, greenery: 0, shopping: 100, transport: 0, education: 0 });
  const busy = mkScores({ shopping: 90 });
  const avoid = new Set(["shopping"] as const);
  const ex = explainMatch(busy, w, undefined, { score: createScorer([{ scores: busy }], w, avoid), avoid });
  assert.ok(ex.considerations.some((c) => /more shopping/i.test(c)));
  assert.ok(!ex.reasons.some((r) => /shopping/i.test(r)));
});
