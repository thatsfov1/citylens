import assert from "node:assert/strict";
import { test } from "node:test";
import { describeAll, describeCategory, describeEducation, describeNightlife, describeSafety, describeSafetyParts } from "../scoring/facts";
import { explainMatch } from "../scoring/explain";
import type { HexIndicators } from "../../types";

const empty = { raw: 0, within500: 0, within1000: 0, nearest: null };
const ind: HexIndicators = {
  sport: { raw: 1, within500: 0, within1000: 4, nearest: { name: null, kind: "pitch", distanceM: 820 } },
  culture: empty,
  shopping: { raw: 5, within500: 37, within1000: 164, nearest: { name: "Biedronka", kind: "supermarket", distanceM: 68 } },
  transport: { raw: 3, within500: 1, within1000: 6, nearest: { name: "Prusy Rondo", kind: "bus_stop", distanceM: 468 } },
  greenery: { raw: 0.4, coverShare: 0.08, nearestPark: { name: "Park Rzeczny Białucha", kind: "green_area", distanceM: 156, areaHa: 1.6 } },
};

test("describes categories from indicators", () => {
  assert.match(describeCategory("shopping", ind), /37 shops within 500 m; nearest: Biedronka \(supermarket\), 70 m away/);
  assert.match(describeCategory("sport", ind), /none within 500 m; nearest: a sports pitch, 820 m away/);
  assert.match(describeCategory("culture", ind), /no cultural venues within 1 km/);
  assert.match(describeCategory("greenery", ind), /Park Rzeczny Białucha \(1.6 ha\), 160 m away; ~8% green cover/);
});

test("ignores vacant units as the nearest shop", () => {
  const v = { ...ind, shopping: { ...ind.shopping, nearest: { name: null, kind: "vacant", distanceM: 68 } } };
  assert.equal(describeCategory("shopping", v), "37 shops within 500 m");
});

test("explainMatch uses facts when given and generic text otherwise", () => {
  const scores = { sport: 20, culture: 10, greenery: 90, shopping: 90, transport: 30, education: 50 };
  const weights = { sport: 0.1, culture: 0, greenery: 0.5, shopping: 0.1, transport: 0.3, education: 0 };
  const withFacts = explainMatch(scores, weights, describeAll(ind));
  assert.ok(withFacts.reasons[0].startsWith("Greenery: Park Rzeczny"));
  assert.ok(withFacts.considerations.some((c) => c.startsWith("Transport is below")));
  const generic = explainMatch(scores, weights);
  assert.ok(generic.reasons[0].includes("top priority"));
});

test("transport facts include measured service frequency when GTFS data is present", () => {
  const gtfs = {
    ...ind,
    transport: {
      raw: 9,
      within500: 4,
      within1000: 12,
      departuresPerHourWithin500: 37.46,
      nearest: { name: "Rondo Mogilskie", kind: "tram_stop", distanceM: 120, departuresPerHour: 14.2 },
    },
  };
  assert.equal(
    describeCategory("transport", gtfs),
    "4 stops and stations within 500 m (~37 departures/h on weekdays); nearest: Rondo Mogilskie (tram stop, ~14 departures/h), 120 m away",
  );
  // Seeds computed from OSM only keep the old wording.
  assert.match(describeCategory("transport", ind), /^1 stop or station within 500 m; nearest: Prusy Rondo \(bus stop\), 470 m away$/);
});

test("safety facts list each indicator with its numbers, and nothing when there is no data", () => {
  assert.deepEqual(describeSafety(ind), []);
  const withSafety: HexIndicators = {
    ...ind,
    safety: {
      lighting: { segments: 40, lit: 38, litShare: 0.93 },
      crime: { area: "Komisariat V", year: 2025, per1000: 41.2, cityPer1000: 52 },
    },
  };
  const facts = describeSafety(withSafety);
  assert.equal(facts.length, 2);
  assert.match(facts[0], /41.2 reported crimes per 1,000 residents in police area Komisariat V \(2025\); city: 52/);
  assert.match(facts[1], /38 of 40 tagged street segments are lit/);
});

test("safety is explained indicator by indicator, with scores, shares and context", () => {
  const withEnv: HexIndicators = {
    ...ind,
    safety: {
      lighting: { segments: 40, lit: 38, litShare: 0.93 },
      cctv: { cameras: 1 },
      emergency: { police: 640, fire: null, hospital: 1850 },
      nightlife: { venues: 6 },
      parts: { lighting: 80, cctv: 40, emergency: 60 },
    },
  };
  const parts = describeSafetyParts(withEnv);
  assert.deepEqual(parts.map((p) => p.key), ["lighting", "cctv", "emergency"]);
  assert.deepEqual(parts.map((p) => p.score), [80, 40, 60]);
  assert.equal(parts.reduce((s, p) => s + (p.sharePct ?? 0), 0), 100);
  assert.equal(parts[1].fact, "1 mapped camera within 500 m");
  assert.equal(parts[2].fact, "Nearest: police 640 m, hospital or clinic 1.9 km");
  assert.equal(describeNightlife(withEnv), "6 bars, pubs and clubs within 300 m");
  assert.equal(describeNightlife({ ...ind, safety: { nightlife: { venues: 0 } } }), "No bars, pubs or clubs within 300 m");
  assert.equal(describeNightlife(ind), null);
  const none: HexIndicators = { ...ind, safety: { emergency: { police: null, fire: null, hospital: null } } };
  assert.equal(describeSafetyParts(none)[0].fact, "No police, fire station or hospital within 3.0 km");
});

test("education facts follow the selected stages and stay factual", () => {
  const stage = (within1000: number, nearest: { name: string | null; kind: string; distanceM: number } | null) => ({
    raw: within1000,
    within500: 0,
    within1000,
    nearest,
  });
  const edu: HexIndicators = {
    ...ind,
    education: {
      ...stage(3, { name: "Przedszkole nr 5", kind: "kindergarten", distanceM: 220 }),
      stages: {
        kindergarten: stage(2, { name: "Przedszkole nr 5", kind: "kindergarten", distanceM: 220 }),
        primary: stage(1, { name: "SP 12", kind: "primary_school", distanceM: 640 }),
        secondary: stage(0, null),
        university: stage(0, null),
      },
    },
  };
  assert.equal(
    describeEducation(edu, ["kindergarten"]),
    "2 kindergartens and nurseries within 1 km; nearest: Przedszkole nr 5 (kindergarten), 220 m away",
  );
  assert.match(describeEducation(edu, ["secondary"]), /^no secondary schools within 1 km/);
  assert.match(describeEducation(edu), /primary school within 1 km; nearest: SP 12/);
  assert.match(describeEducation(ind), /no education data/); // rows scored before education existed
});
