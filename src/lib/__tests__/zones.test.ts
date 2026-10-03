import assert from "node:assert/strict";
import { test } from "node:test";
import { gridDisk } from "h3-js";
import { bandOf, bandZones } from "../map/zones";

test("bandOf buckets percentiles into quintiles", () => {
  assert.equal(bandOf(0), 0);
  assert.equal(bandOf(0.199), 0);
  assert.equal(bandOf(0.2), 1);
  assert.equal(bandOf(0.5), 2);
  assert.equal(bandOf(0.99), 4);
  assert.equal(bandOf(1), 4);
});

test("bandZones dissolves adjacent same-band cells into one polygon", () => {
  const [a, b] = gridDisk("891e2e5b6b7ffff", 1).slice(0, 2);
  const far = "891e2e5a003ffff";
  const fc = bandZones([a, b, far], [2, 2, 2]);
  assert.equal(fc.features.length, 1);
  const geom = fc.features[0].geometry as GeoJSON.MultiPolygon;
  assert.equal(geom.coordinates.length, 2); // joined pair + the disjoint cell
});

test("bandZones separates different bands", () => {
  const [a, b] = gridDisk("891e2e5b6b7ffff", 1).slice(0, 2);
  const fc = bandZones([a, b], [0, 4]);
  assert.equal(fc.features.length, 2);
});
