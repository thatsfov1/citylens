import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute, parseTable } from "../data/routing";
import { classifyCommute, estimateMinutes, workplaceFromQuery, workplaceToQuery, type Workplace } from "../scoring/commute";

const work: Workplace = { name: "Rynek Główny, Kraków", lat: 50.0617, lng: 19.9373, mode: "transit", maxMin: 30 };

test("workplace survives a query round trip, including commas in the name", () => {
  assert.deepEqual(workplaceFromQuery(workplaceToQuery(work).slice("work=".length)), work);
});

test("invalid workplace params are ignored", () => {
  assert.equal(workplaceFromQuery(undefined), null);
  assert.equal(workplaceFromQuery("1,2,plane,30,x"), null);
  assert.equal(workplaceFromQuery("50,19,walk,1,x"), null);
});

test("estimated minutes grow with distance and differ by mode", () => {
  assert.ok(estimateMinutes(5000, "walk") > estimateMinutes(5000, "car"));
  assert.ok(estimateMinutes(2000, "bike") < estimateMinutes(4000, "bike"));
});

test("hexes beyond the limit are dimmed", () => {
  const fit = classifyCommute({ a: 10, b: 31, c: 30 }, 30);
  assert.deepEqual([...fit.outside], ["b"]);
  assert.equal(fit.within, 2);
});

test("when nothing is within the limit nothing is dimmed and the nearest option is reported", () => {
  const fit = classifyCommute({ a: 38, b: 50 }, 30);
  assert.equal(fit.outside.size, 0);
  assert.equal(fit.within, 0);
  assert.equal(fit.nearestMin, 38);
});

test("OSRM route parsing returns the path, minutes and distance", () => {
  const raw = { code: "Ok", routes: [{ duration: 600, distance: 2500.4, geometry: { coordinates: [[19.9, 50.0], [19.95, 50.06]] } }] };
  assert.deepEqual(parseRoute(raw), { coordinates: [[19.9, 50.0], [19.95, 50.06]], minutes: 10, distanceM: 2500 });
  assert.equal(parseRoute({ code: "NoRoute", routes: [] }), null);
});

test("OSRM table parsing converts seconds to minutes and keeps unroutable cells as null", () => {
  assert.deepEqual(parseTable({ code: "Ok", durations: [[660.7], [null]] }, 2), [11, null]);
  assert.equal(parseTable({ code: "Ok", durations: [[1]] }, 2), null);
  assert.equal(parseTable({ code: "InvalidQuery" }, 1), null);
});
