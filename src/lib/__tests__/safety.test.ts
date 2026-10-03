import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIN_LIGHTING_SEGMENTS,
  cityLitShare,
  combineSafety,
  crimeIndicator,
  rankScores,
  scoreLighting,
  type CrimeFile,
  type LightingFile,
} from "../data/safety";

const center: [number, number] = [19.9372, 50.0614];
const near = (m: number): [number, number] => [center[0], center[1] + m / 110574];
const file = (pts: [number, number, 0 | 1][]): LightingFile => ({ source: "test", fetched: "2026-10-03", points: pts });

test("lighting needs enough tagged segments, otherwise no data", () => {
  const few = file(Array.from({ length: MIN_LIGHTING_SEGMENTS - 1 }, () => [...near(100), 1] as [number, number, 1]));
  assert.equal(scoreLighting(center, few, 0.9), null);
});

test("lighting counts only segments within the radius and smooths toward the city share", () => {
  const pts: [number, number, 0 | 1][] = [
    ...Array.from({ length: 10 }, () => [...near(200), 1] as [number, number, 1]),
    ...Array.from({ length: 5 }, () => [...near(300), 0] as [number, number, 0]),
    ...Array.from({ length: 50 }, () => [...near(5000), 0] as [number, number, 0]), // too far, ignored
  ];
  const r = scoreLighting(center, file(pts), 0.9)!;
  assert.equal(r.segments, 15);
  assert.equal(r.lit, 10);
  // (10 + 10*0.9) / (15 + 10) = 0.76
  assert.ok(Math.abs(r.litShare - 0.76) < 1e-9);
  assert.ok(Math.abs(cityLitShare(file(pts)) - 10 / 65) < 1e-9);
});

const crimeFile: CrimeFile = {
  source: "test",
  sourceUrl: "https://example.org",
  year: 2025,
  categories: "test",
  areas: [
    { name: "A", districts: ["Stare Miasto"], crimes: 300, residents: 30_000 },
    { name: "B", districts: ["Nowa Huta", "Czyżyny"], crimes: 100, residents: 20_000 },
  ],
};

test("crime is normalised per 1,000 residents and compared with the city", () => {
  const a = crimeIndicator("Stare Miasto", crimeFile)!;
  assert.equal(a.per1000, 10);
  assert.equal(a.cityPer1000, 8);
  assert.equal(crimeIndicator("Czyżyny", crimeFile)!.per1000, 5);
  assert.equal(crimeIndicator("Unknown", crimeFile), null);
  assert.equal(crimeIndicator(null, crimeFile), null);
});

test("percentile ranks: lowest 0, highest 100, ties share a rank", () => {
  assert.deepEqual(rankScores([5, 1, 3]), [100, 0, 50]);
  assert.deepEqual(rankScores([2, 2, 2]), [50, 50, 50]);
  assert.deepEqual(rankScores([7]), [50]);
});

test("combineSafety renormalises over available indicators", () => {
  assert.equal(combineSafety({}), null);
  assert.equal(combineSafety({ lighting: 80 }), 80);
  assert.equal(combineSafety({ crime: 50 }), 50);
  // crime 0.6, lighting 0.4
  assert.equal(combineSafety({ crime: 100, lighting: 0 }), 60);
});
