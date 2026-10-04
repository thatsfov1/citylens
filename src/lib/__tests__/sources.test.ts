import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SOURCES, SOURCES_BY_TOPIC, formatAsOf } from "../sources";

const json = (p: string) => JSON.parse(readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8"));

test("every source has an id matching its key, a license and an https url", () => {
  for (const [key, s] of Object.entries(SOURCES)) {
    assert.equal(s.id, key);
    assert.ok(s.license.length > 0);
    assert.match(s.url, /^https:\/\//);
  }
});

test("every topic points at existing sources", () => {
  for (const ids of Object.values(SOURCES_BY_TOPIC)) {
    assert.ok(ids.length > 0);
    for (const id of ids) assert.ok(id in SOURCES, id);
  }
});

test("formatAsOf: day, month, live and unknown", () => {
  assert.equal(formatAsOf("2026-10-03"), "3 paź 2026");
  assert.equal(formatAsOf("20261006"), "6 paź 2026");
  assert.equal(formatAsOf("2019-05"), "maj 2019");
  assert.equal(formatAsOf("live"), "na żywo");
  assert.equal(formatAsOf(null), "data pobrania nieznana");
  assert.equal(formatAsOf("2026-13"), "data pobrania nieznana");
});

test("stored dates in the registry match the data files they come from", () => {
  assert.equal(SOURCES.gios.asOf, json("data/air/stations.json").fetched);
  assert.equal(formatAsOf(SOURCES.gtfs.asOf), formatAsOf(json("data/gtfs/stops.json").serviceDate));
  assert.equal(SOURCES.otodom.asOf, json("src/lib/data/rent-data.json").snapshot);
});

test("OSM date is unknown until scripts/osm/fetch.ts records one in data/osm/meta.json", () => {
  let fetched: string | null = null;
  try {
    fetched = json("data/osm/meta.json").fetched;
  } catch {}
  assert.equal(SOURCES.osm.asOf, fetched);
});
