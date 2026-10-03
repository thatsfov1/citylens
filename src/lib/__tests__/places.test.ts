import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectPlaces, type RawPoi } from "../data/places";
import { circleRing } from "../map/places";
import { haversine } from "../data/geo";

const center: [number, number] = [19.94, 50.06];
const at = (id: number, category: RawPoi["category"], kind: string, dLat: number): RawPoi => ({
  id, category, kind, name: null, lng: center[0], lat: center[1] + dLat,
});

describe("selectPlaces", () => {
  it("sorts by distance, caps per category and respects reach", () => {
    const pois = [
      ...Array.from({ length: 15 }, (_, i) => at(i, "sport", "pitch", 0.0005 * (i + 1))),
      at(100, "shopping", "supermarket", 0.02), // ~2.2 km: beyond shopping reach
      at(101, "culture", "museum", 0.015), // ~1.7 km: within culture reach (2 km)
    ];
    const out = selectPlaces(center, pois);
    const sport = out.filter((p) => p.category === "sport");
    assert.equal(sport.length, 10);
    assert.deepEqual(sport.map((p) => p.distanceM), [...sport.map((p) => p.distanceM)].sort((a, b) => a - b));
    assert.equal(out.some((p) => p.category === "shopping"), false);
    assert.equal(out.some((p) => p.id === 101), true);
  });

  it("keeps rail/tram ahead of buses and limits buses", () => {
    const pois = [
      ...Array.from({ length: 12 }, (_, i) => at(i, "transport", "bus_stop", 0.0002 * (i + 1))),
      at(50, "transport", "rail_station", 0.008),
    ];
    const out = selectPlaces(center, pois);
    assert.equal(out.filter((p) => p.kind === "bus_stop").length, 6);
    assert.equal(out.some((p) => p.kind === "rail_station"), true);
  });
});

describe("circleRing", () => {
  it("is closed and ~radius from the centre", () => {
    const ring = circleRing(center, 500);
    assert.deepEqual(ring[0], ring.at(-1));
    for (const p of ring) assert.ok(Math.abs(haversine(center, p) - 500) < 5);
  });
});
