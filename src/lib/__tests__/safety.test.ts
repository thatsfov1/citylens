import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MIN_LIGHTING_SEGMENTS,
  cctvRaw,
  cityLitShare,
  combineSafety,
  crimeIndicator,
  emergencyRaw,
  hasStreets,
  partShares,
  rankScores,
  scoreFeatures,
  scoreLighting,
  type CrimeFile,
  type FeaturesFile,
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
  // crime 0.4, lighting 0.5 → 100 * 0.4 / 0.9
  assert.equal(combineSafety({ crime: 100, lighting: 0 }), 44);
  assert.equal(combineSafety({ lighting: 50, cctv: 50, emergency: 50 }), 50);
});

const features = (pts: [number, number, string][]): FeaturesFile => {
  const kinds = ["police", "fire_station", "hospital", "cctv", "nightlife"] as const;
  return { source: "test", fetched: "2026-10-03", kinds: [...kinds], points: pts.map(([lng, lat, k]) => [lng, lat, kinds.indexOf(k as (typeof kinds)[number])]) };
};

test("street features are counted within their own radii", () => {
  const f = features([
    [...near(300), "cctv"],
    [...near(450), "cctv"],
    [...near(700), "cctv"], // outside 500 m
    [...near(100), "nightlife"],
    [...near(250), "nightlife"],
    [...near(400), "nightlife"], // outside 300 m
    [...near(1200), "police"],
    [...near(2000), "police"], // farther police is ignored: nearest wins
    [...near(2500), "hospital"],
    [...near(4000), "fire_station"], // beyond 3 km
  ] as [number, number, string][]);
  const r = scoreFeatures(center, f);
  assert.deepEqual(r.cctv, { cameras: 2 });
  assert.deepEqual(r.nightlife, { venues: 2 });
  assert.equal(r.emergency.police! > 1100 && r.emergency.police! < 1300, true);
  assert.equal(r.emergency.fire, null);
  assert.equal(r.emergency.hospital! > 2400 && r.emergency.hospital! < 2600, true);
});

test("raw values: more cameras and closer services score higher", () => {
  assert.ok(cctvRaw({ cameras: 3 }) > cctvRaw({ cameras: 0 }));
  assert.ok(emergencyRaw({ police: 300, fire: null, hospital: null }) > emergencyRaw({ police: 2500, fire: null, hospital: null }));
  assert.equal(emergencyRaw({ police: null, fire: null, hospital: null }), 0);
});

test("open land (no lighting data, no camera) has no safety data", () => {
  assert.equal(hasStreets({ cctv: { cameras: 0 } }), false);
  assert.equal(hasStreets({ cctv: { cameras: 1 } }), true);
  assert.equal(hasStreets({ lighting: { segments: 9, lit: 9, litShare: 0.9 } }), true);
  assert.equal(hasStreets({}), false);
});

test("indicator shares add up to 100% over the indicators present", () => {
  const shares = partShares({ lighting: 80, cctv: 20, emergency: 50 });
  assert.equal(Math.round(100 * (shares.lighting! + shares.cctv! + shares.emergency!)), 100);
  assert.ok(shares.lighting! > shares.cctv!);
  assert.deepEqual(partShares({}), {});
});
