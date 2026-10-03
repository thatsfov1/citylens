import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FULL_SHARE,
  OUT_SHARE,
  RENT_MAX,
  RENT_MIN,
  budgetToFilter,
  classifyHexes,
  costsFor,
  feeFor,
  formatRentRange,
  otodomDistrictSlug,
  otodomUrl,
  rentFit,
  rentFromQuery,
  rentToQuery,
  shareWithin,
  summarizeRent,
  type RentFilter,
} from "../scoring/rent";
import rentData from "../data/rent-data.json";

const group = (offers: [number, number | null][], fee: number | null = 600) => ({
  n: offers.length,
  p25: offers[0][0],
  median: offers[Math.floor(offers.length / 2)][0],
  p75: offers.at(-1)![0],
  fee,
  feeKnown: offers.filter((o) => o[1] !== null).length,
  offers,
});
// A: ten offers from 2 000 to 3 800 (czynsz 600 on every second one), B: cheap, C: no data.
const A = group(Array.from({ length: 10 }, (_, i): [number, number | null] => [2000 + i * 200, i % 2 ? 600 : null]));
const B = group(Array.from({ length: 10 }, (_, i): [number, number | null] => [1500 + i * 50, 400]), 400);
const table = { A: { "2": A }, B: { "2": B }, C: {} };
const f = (min: number, max: number, fees = false, rooms: 1 | 2 | 3 = 2): RentFilter => ({ min, max, rooms, fees });

test("share counts the offers inside the range, inclusive; the slider ends mean no limit", () => {
  const costs = [2000, 2500, 3000, 3500];
  assert.equal(shareWithin(costs, f(2500, 3500)), 0.75);
  assert.equal(shareWithin(costs, f(RENT_MIN, 2500)), 0.5);
  assert.equal(shareWithin(costs, f(3000, RENT_MAX)), 0.5);
  assert.equal(shareWithin(costs, f(RENT_MIN, RENT_MAX)), 1);
  assert.equal(shareWithin([], f(2000, 3000)), 0);
});

test("with czynsz on, every offer costs base rent plus its fee, or the typical fee when it does not state one", () => {
  assert.deepEqual(costsFor("A", 2, false, table)?.slice(0, 2), [2000, 2200]);
  assert.deepEqual(costsFor("A", 2, true, table)?.slice(0, 2), [2600, 2800]); // 2000 + typical 600, 2200 + stated 600
  assert.equal(costsFor("C", 2, true, table), null);
  assert.equal(costsFor(null, 2, true, table), null);
  assert.equal(feeFor("A", 2, table), 600);
});

test("fit tiers", () => {
  assert.equal(rentFit(null), "unknown");
  assert.equal(rentFit(FULL_SHARE), "in");
  assert.equal(rentFit(OUT_SHARE), "some");
  assert.equal(rentFit(OUT_SHARE - 0.01), "out");
  assert.equal(rentFit(0), "out");
});

test("classifyHexes grades hexes by their district's offers", () => {
  const hexes = [
    { h3Index: "1", district: "A" },
    { h3Index: "2", district: "B" },
    { h3Index: "3", district: "C" },
    { h3Index: "4", district: null },
  ];
  const { over, unknown, share } = classifyHexes(hexes, f(2000, 2600), table);
  assert.equal(share.get("1"), 0.4); // 2000, 2200, 2400, 2600
  assert.equal(share.get("2"), 0); // B has offers from 1 500 to 1 950: none inside 2 000 to 2 600
  assert.deepEqual([...over], ["2"]);
  assert.deepEqual([...unknown].sort(), ["3", "4"]);
});

test("summary reports how many offers fit", () => {
  const s = summarizeRent("A", f(2000, 2600), table);
  assert.equal(s.within, 4);
  assert.equal(s.fit, "some");
  assert.equal(s.fee, 600);
});

test("regression: ordinary budgets change the picture, the old median rule greyed nothing", () => {
  const hexes = Object.keys(rentData.districts).map((d) => ({ h3Index: d, district: d }));
  const shares = (filter: RentFilter) => classifyHexes(hexes, filter).share;
  // Every handle move shifts at least one district's share.
  const a = shares(f(2000, 3500, true));
  const b = shares(f(2000, 3000, true));
  assert.ok([...a.keys()].some((k) => a.get(k) !== b.get(k)));
  // A typical range fades at least one district below the full-colour threshold.
  assert.ok([...shares(f(2000, 4000, true)).values()].some((v) => v < FULL_SHARE));
  // With only an upper limit, counting czynsz makes a budget stricter, never looser.
  const without = shares(f(RENT_MIN, 4000, false));
  const withFees = shares(f(RENT_MIN, 4000, true));
  for (const [k, v] of withFees) assert.ok(v <= (without.get(k) ?? 1) + 1e-9, k);
});

test("query round trip keeps the czynsz choice, and invalid or unbounded values are ignored", () => {
  const on = f(2500, 4000, true, 3);
  assert.equal(rentToQuery(on), "rent=2500-4000&rooms=3");
  assert.deepEqual(rentFromQuery(Object.fromEntries(new URLSearchParams(rentToQuery(on)))), on);
  const off = f(2500, 4000, false, 3);
  assert.equal(rentToQuery(off), "rent=2500-4000&rooms=3&czynsz=0");
  assert.deepEqual(rentFromQuery(Object.fromEntries(new URLSearchParams(rentToQuery(off)))), off);
  assert.equal(rentFromQuery({ rent: "4000-2500" }), null);
  assert.equal(rentFromQuery({ rent: "abc" }), null);
  assert.equal(rentFromQuery({ rent: "2500-4000", rooms: "9" }), null);
  assert.equal(rentFromQuery({ rent: `${RENT_MIN}-${RENT_MAX}` }), null);
  assert.deepEqual(rentFromQuery({ rent: "2500-4000" }), f(2500, 4000, true, 2));
});

test("a stated budget becomes a valid filter, snapped to the slider step, with czynsz counted", () => {
  assert.deepEqual(budgetToFilter({ min: null, max: 3540, rooms: null }), f(RENT_MIN, 3500, true));
  assert.deepEqual(budgetToFilter({ min: 2000, max: 3000, rooms: 1 }), f(2000, 3000, true, 1));
  assert.deepEqual(budgetToFilter({ min: 2000, max: null, rooms: 3 }), f(2000, RENT_MAX, true, 3));
  assert.equal(budgetToFilter({ min: 100, max: 99999, rooms: null }), null);
  assert.equal(budgetToFilter({ min: 4000, max: 2000, rooms: null }), null);
  assert.equal(budgetToFilter({ min: null, max: null, rooms: 2 }), null);
  assert.equal(budgetToFilter(null), null);
});

test("range text", () => {
  assert.equal(formatRentRange({ min: RENT_MIN, max: 3000 }), "up to 3 000 zł");
  assert.equal(formatRentRange({ min: 2500, max: RENT_MAX }), "from 2 500 zł");
  assert.equal(formatRentRange({ min: RENT_MIN, max: RENT_MAX }), "any rent");
});

test("Otodom district slugs follow its spelling", () => {
  assert.equal(otodomDistrictSlug("Prądnik Biały"), "pradnik-bialy");
  assert.equal(otodomDistrictSlug("Bieżanów-Prokocim"), "biezanow--prokocim");
  assert.equal(otodomDistrictSlug("Łagiewniki-Borek Fałęcki"), "lagiewniki--borek-falecki");
  assert.equal(otodomDistrictSlug("Wzgórza Krzesławickie"), "wzgorza-krzeslawickie");
});

test("Otodom link carries district and flat size, and lowers the limits by the czynsz when it is counted", () => {
  const fee = feeFor("Prądnik Biały", 2);
  assert.ok(fee > 0);
  const base = (n: number) => Math.round((n - fee) / 50) * 50;
  const on = new URL(otodomUrl(f(2500, 4000, true), "Prądnik Biały"));
  assert.ok(on.pathname.endsWith("/krakow/krakow/krakow/pradnik-bialy"));
  assert.equal(on.searchParams.get("roomsNumber"), "[TWO]");
  assert.equal(on.searchParams.get("priceMin"), String(base(2500)));
  assert.equal(on.searchParams.get("priceMax"), String(base(4000)));
  const off = new URL(otodomUrl(f(2500, 4000, false), "Prądnik Biały"));
  assert.equal(off.searchParams.get("priceMin"), "2500");
  assert.equal(off.searchParams.get("priceMax"), "4000");
  const open = new URL(otodomUrl(f(RENT_MIN, 3000, false, 3)));
  assert.equal(open.searchParams.get("priceMin"), null);
  assert.equal(open.searchParams.get("roomsNumber"), "[THREE,FOUR,FIVE,SIX_OR_MORE]");
  assert.ok(open.pathname.endsWith("/krakow/krakow/krakow"));
});
