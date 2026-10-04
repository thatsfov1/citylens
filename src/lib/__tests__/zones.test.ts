import assert from "node:assert/strict";
import { test } from "node:test";
import { cellToLatLng, gridDisk } from "h3-js";
import { bandOf } from "../map/zones";
import { heatPixels, rampColor } from "../map/heat-field";

test("bandOf buckets percentiles into quintiles", () => {
  assert.equal(bandOf(0), 0);
  assert.equal(bandOf(0.199), 0);
  assert.equal(bandOf(0.2), 1);
  assert.equal(bandOf(0.5), 2);
  assert.equal(bandOf(0.99), 4);
  assert.equal(bandOf(1), 4);
});

test("rampColor runs continuously from red to green", () => {
  const [r0, g0] = rampColor(0);
  const [r1, g1] = rampColor(1);
  assert.ok(r0 > g0 && g1 > r1);
  const mid = rampColor(0.5);
  assert.deepEqual(rampColor(0.49).map((c, i) => Math.abs(c - mid[i]) <= 12), [true, true, true]);
});

test("heatPixels blends neighbouring hexes and leaves empty space transparent", () => {
  const cells = gridDisk("891e2e5b6b7ffff", 2);
  const values = cells.map((_, i) => (i === 0 ? 0 : 1));
  const noData = cells.map(() => false);
  const lls = cells.map((c) => cellToLatLng(c));
  const lats = lls.map((l) => l[0]);
  const lngs = lls.map((l) => l[1]);
  const bounds = { west: Math.min(...lngs) - 0.1, east: Math.max(...lngs) + 0.1, south: Math.min(...lats) - 0.1, north: Math.max(...lats) + 0.1 };
  const { width, height, data } = heatPixels({ cells, values, noData }, bounds, 120);
  assert.equal(data.length, width * height * 4);
  assert.equal(data[3], 0); // corner is far from any hex
  const px = (lat: number, lng: number) => {
    const x = Math.floor(((lng - bounds.west) / (bounds.east - bounds.west)) * width);
    const y = Math.floor(((bounds.north - lat) / (bounds.north - bounds.south)) * height);
    return (y * width + x) * 4;
  };
  const red = data[px(lls[0][0], lls[0][1])];
  const near = data[px((lls[0][0] + lls[1][0]) / 2, (lls[0][1] + lls[1][1]) / 2)];
  const far = data[px(lls[10][0], lls[10][1])];
  assert.ok(red > near && near > far, `expected a gradient, got ${red} > ${near} > ${far}`);
});
