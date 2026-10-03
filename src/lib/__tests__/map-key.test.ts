import assert from "node:assert/strict";
import { test } from "node:test";
import { KEY_ENTRIES, KEY_GROUPS, keySections, type KeyContext } from "../map/key";

const none: KeyContext = { areaOpen: false, car: false, workplace: false, comparing: false };
const ids = (ctx: KeyContext) => keySections(ctx).flatMap((s) => s.entries.map((e) => e.id));

test("with nothing open only the always-on lines are listed", () => {
  assert.deepEqual(ids(none), ["strongest", "districts"]);
});

test("pins, badges and rings need an open area", () => {
  const open = ids({ ...none, areaOpen: true });
  for (const id of ["places", "green", "badge-safety", "badge-air", "badge-works", "badge-compare", "rings"]) assert.ok(open.includes(id), id);
  assert.ok(!ids(none).includes("places"));
});

test("parking entries appear only for people with a car, and the grey dot is named as a meter", () => {
  assert.ok(!ids({ ...none, areaOpen: true }).includes("meter"));
  const withCar = keySections({ ...none, car: true });
  const parking = withCar.find((s) => s.id === "parking");
  assert.deepEqual(parking?.entries.map((e) => e.id), ["carpark", "parkride", "meter"]);
  const meter = parking?.entries.find((e) => e.id === "meter");
  assert.match(meter?.label ?? "", /parkometr/i);
  assert.match(meter?.meaning ?? "", /płatne/i);
  assert.match(parking?.note ?? "", /nie gwarantuje/i);
});

test("compared outline and workplace route follow their state", () => {
  assert.ok(!ids({ ...none, areaOpen: true }).includes("compared"));
  assert.ok(ids({ ...none, comparing: true }).includes("compared"));
  assert.ok(!ids({ ...none, workplace: true }).includes("route"));
  const w = ids({ ...none, workplace: true, areaOpen: true });
  assert.ok(w.includes("route") && w.includes("work"));
});

test("the catalogue is consistent: unique ids, known groups, a label and a meaning for each", () => {
  assert.equal(new Set(KEY_ENTRIES.map((e) => e.id)).size, KEY_ENTRIES.length);
  const groups = new Set(KEY_GROUPS.map((g) => g.id));
  for (const e of KEY_ENTRIES) {
    assert.ok(groups.has(e.group), e.id);
    assert.ok(e.label.length > 0 && e.meaning.length > 10, e.id);
  }
});
