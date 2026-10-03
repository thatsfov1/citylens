import { test } from "node:test";
import assert from "node:assert/strict";
import { latLngToCell } from "h3-js";
import { anchorFromQuery, anchorToQuery, hexesOutsideAnchor, type Anchor } from "../scoring/anchor";

const agh: Anchor = { name: "AGH, Akademia Górniczo-Hutnicza", lat: 50.0647, lng: 19.9232, radiusM: 1500 };

test("anchor survives a query round trip, including commas in the name", () => {
  const back = anchorFromQuery(anchorToQuery(agh).slice("near=".length));
  assert.deepEqual(back, { ...agh, lat: 50.0647, lng: 19.9232 });
});

test("invalid anchor params are ignored", () => {
  assert.equal(anchorFromQuery(undefined), null);
  assert.equal(anchorFromQuery("x,y,z,Name"), null);
  assert.equal(anchorFromQuery("50,19,9,Name"), null);
});

test("hexes outside the radius are reported, nearby ones are not", () => {
  const near = latLngToCell(50.0647, 19.9232, 9);
  const far = latLngToCell(50.1, 20.1, 9);
  const out = hexesOutsideAnchor([near, far], agh);
  assert.equal(out.has(near), false);
  assert.equal(out.has(far), true);
});

import { pickCandidate } from "../data/anchors";

test("picks the exact name first, then the more anchor-like kind", () => {
  const c = [
    { name: "AGH Bus Stop", kind: "bus_stop", lat: 1, lng: 1 },
    { name: "AGH", kind: "bus_stop", lat: 2, lng: 2 },
    { name: "AGH", kind: "university", lat: 3, lng: 3 },
  ];
  assert.equal(pickCandidate("agh", c)?.lat, 3);
  assert.equal(pickCandidate("agh", []), null);
});

import { parseNominatim } from "../data/nominatim";

test("parses a Nominatim hit and rejects junk", () => {
  const hit = parseNominatim([{ name: "ulica Floriańska", display_name: "ulica Floriańska, Kraków", lat: "50.0643", lon: "19.9407" }]);
  assert.deepEqual(hit, { name: "ulica Floriańska", lat: 50.0643, lng: 19.9407 });
  assert.equal(parseNominatim([]), null);
  assert.equal(parseNominatim({ error: "x" }), null);
});

test("generic words are stripped from a place query", async () => {
  const { cleanPlaceQuery } = await import("../data/anchors");
  assert.equal(cleanPlaceQuery("Czyzyny district"), "Czyzyny");
  assert.equal(cleanPlaceQuery("dzielnica Czyżyny"), "Czyżyny");
  assert.equal(cleanPlaceQuery("okolice AGH"), "AGH");
  assert.equal(cleanPlaceQuery("district"), "district");
});
