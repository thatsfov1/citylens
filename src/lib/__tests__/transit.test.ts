import test from "node:test";
import assert from "node:assert/strict";
import { planTransit, type Timetable } from "../data/transit";

// Three stops ~1.1 km apart on a line (A, B, C), tram "8" every 10 min from 08:00; bus "9" B→D with D far away.
const tt: Timetable = {
  source: "test",
  serviceDate: "20260101",
  window: "",
  stops: [
    ["A", 19.9, 50.0],
    ["B", 19.9, 50.01],
    ["C", 19.9, 50.02],
    ["D", 19.9, 50.04],
  ],
  patterns: [
    ["8", 1, "C", [0, 1, 2], [0, 180, 360], [28800, 29400, 30000]],
    ["9", 0, "D", [2, 3], [0, 300], [29400, 30000]],
  ],
};

test("direct ride: boards at the right stop and reports line and stops", () => {
  const plan = planTransit(tt, { lat: 50.0003, lng: 19.9 }, { lat: 50.0103, lng: 19.9 }, 28700)!;
  assert.equal(plan.transfers, 0);
  const ride = plan.legs.find((l) => l.type === "ride");
  assert.ok(ride && ride.type === "ride");
  assert.equal(ride.line, "8");
  assert.equal(ride.boardStop, "A");
  assert.equal(ride.alightStop, "B");
});

test("one transfer between lines", () => {
  const plan = planTransit(tt, { lat: 50.0003, lng: 19.9 }, { lat: 50.0403, lng: 19.9 }, 28700)!;
  assert.equal(plan.transfers, 1);
  const rides = plan.legs.filter((l) => l.type === "ride");
  assert.deepEqual(rides.map((r) => r.type === "ride" && r.line), ["8", "9"]);
});

test("no stop within reach and too far to walk gives null", () => {
  assert.equal(planTransit(tt, { lat: 51.0, lng: 21.0 }, { lat: 50.0403, lng: 19.9 }, 28700), null);
});

test("a short trip is just a walk", () => {
  const plan = planTransit(tt, { lat: 50.0, lng: 19.9 }, { lat: 50.0008, lng: 19.9 }, 28700)!;
  assert.deepEqual(plan.legs.map((l) => l.type), ["walk"]);
});
