import assert from "node:assert/strict";
import { test } from "node:test";
import { carParkLabel, parkingAround, parkingPins, type ParkingData } from "../scoring/parking";

const centre: [number, number] = [50.0614, 19.9372];
/** A point `m` metres north of the centre. */
const north = (m: number): [number, number] => [centre[0] + m / 111_195, centre[1]];

const empty: ParkingData = { retrieved: { osm: null, msip: null }, metersAsOf: null, carParks: [], streets: [], parkRide: [], meters: [] };
const data = (over: Partial<ParkingData>): ParkingData => ({ ...empty, ...over });

test("a source that was never loaded is 'no data', not zero", () => {
  const f = parkingAround(centre, empty);
  assert.deepEqual(f.availability, { osm: false, meters: false });
  const metersOnly = parkingAround(centre, data({ meters: [north(100)] }));
  assert.deepEqual(metersOnly.availability, { osm: false, meters: true });
  assert.equal(metersOnly.meters.within500, 1);
});

test("car parks are counted by ring and only the publicly usable ones", () => {
  const f = parkingAround(
    centre,
    data({
      carParks: [
        [...north(200), "surface", "public", 0, 40],
        [...north(700), "garage", "public", 1, 0],
        [...north(300), "surface", "private", -1, 0],
        [...north(100), "surface", "customers", -1, 0],
        [...north(1500), "surface", "public", -1, 0],
      ],
    }),
  );
  assert.equal(f.carParks.within500, 1);
  assert.equal(f.carParks.within1000, 2);
  assert.equal(f.carParks.restricted, 2);
  assert.deepEqual(f.carParks.nearest, { distanceM: 200, kind: "surface", fee: 0 });
});

test("none found within range is a real zero when the source is present", () => {
  const f = parkingAround(centre, data({ carParks: [[...north(5000), "surface", "public", -1, 0]] }));
  assert.equal(f.availability.osm, true);
  assert.equal(f.carParks.within1000, 0);
  assert.equal(f.carParks.nearest, null);
});

test("street parking segments are pooled and split by tagged fee", () => {
  const f = parkingAround(centre, data({ streets: [[...north(100), 6, 4, 1], [...north(400), 3, 0, 2], [...north(900), 9, 9, 0]] }));
  assert.deepEqual(f.streets, { within500: 9, paid: 4, free: 3 });
});

test("nearest park and ride and parking meters within 500 m", () => {
  const f = parkingAround(
    centre,
    data({
      parkRide: [[...north(4000), "P+R Far"], [...north(2500), "P+R Near"]],
      meters: [north(100), north(499), north(600)],
    }),
  );
  assert.deepEqual(f.parkRide.nearest, { name: "P+R Near", distanceM: 2500 });
  assert.equal(f.meters.within500, 2);
});

test("pins skip private lots and respect the radius", () => {
  const pins = parkingPins(
    centre,
    data({
      carParks: [[...north(200), "surface", "public", 1, 25], [...north(300), "surface", "private", -1, 0], [...north(2000), "garage", "public", -1, 0]],
      parkRide: [[...north(800), "P+R Test"]],
      meters: [north(150)],
    }),
  );
  assert.deepEqual(pins.map((p) => p.kind).sort(), ["carpark", "meter", "parkride"]);
  assert.equal(pins.find((p) => p.kind === "carpark")?.label, "Car park, paid, about 25 spaces");
  assert.equal(carParkLabel([0, 0, "garage", "public", -1, 0]), "Garage");
});
