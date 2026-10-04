import assert from "node:assert/strict";
import { test } from "node:test";
import { latLngToCell } from "h3-js";
import type { AirFile } from "../data/air";
import { airCells, applyLiveAir, newestReading, type LiveAirResponse } from "../data/air-live";
import { fetchGiosStations, newestMean } from "../data/gios";
import { describeAir } from "../scoring/facts";
import type { HexIndicators } from "../../types";

const rows = (vals: (number | null)[]) =>
  vals.map((v, i) => ({ Data: `2026-10-04 ${String(i).padStart(2, "0")}:00:00`, Wartość: v }));

test("newestMean averages only the newest valid readings", () => {
  const m = newestMean(rows([100, 100, null, 20, 30, 40]), 3, 3);
  assert.equal(m?.mean, 30); // 20, 30, 40: the null and the old 100s are out
  assert.equal(m?.latest, "2026-10-04 05:00:00");
});

test("newestMean without a window uses everything, and refuses too few readings", () => {
  assert.equal(newestMean(rows([10, 20]), null, 2)?.mean, 15);
  assert.equal(newestMean(rows([10, null]), null, 2), null);
  assert.equal(newestMean(rows([10, 20, 30]), 24, 18), null);
});

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("fetchGiosStations reads Kraków stations and skips manual sensors (400)", async () => {
  const data = (vals: number[]) => ({ "Lista danych pomiarowych": rows(vals) });
  const fetchFn = (async (url: string) => {
    if (url.includes("station/findAll"))
      return reply({
        "Lista stacji pomiarowych": [
          { "Identyfikator stacji": 1, "Nazwa stacji": "Kraków, Aleja Krasińskiego", "WGS84 φ N": "50.057", "WGS84 λ E": "19.926", "Nazwa miasta": "Kraków" },
          { "Identyfikator stacji": 2, "Nazwa stacji": "Gdańsk", "WGS84 φ N": "54.3", "WGS84 λ E": "18.6", "Nazwa miasta": "Gdańsk" },
          { "Identyfikator stacji": 3, "Nazwa stacji": "Kraków, manual", "WGS84 φ N": "50.0", "WGS84 λ E": "19.9", "Nazwa miasta": "Kraków" },
        ],
      });
    if (url.includes("station/sensors/1"))
      return reply({ "Lista stanowisk pomiarowych dla podanej stacji": [{ "Identyfikator stanowiska": 11, "Wskaźnik - kod": "PM10" }] });
    if (url.includes("station/sensors/3")) return reply({}, 400);
    if (url.includes("data/getData/11")) return reply(data([10, 20, 30, 40]));
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  const file = await fetchGiosStations({ windowHours: 2, minHours: 2, attempts: 1, timeoutMs: 1000, fetchFn });
  assert.equal(file.windowHours, 2);
  assert.equal(file.stations.length, 1);
  assert.equal(file.stations[0].name, "Aleja Krasińskiego");
  assert.equal(file.stations[0].pm10, 35); // 30 and 40
  assert.equal(file.stations[0].asOf, "2026-10-04 03:00:00");
});

test("a station list that cannot be read throws, so the route can fall back", async () => {
  const fetchFn = (async () => reply({}, 500)) as typeof fetch;
  await assert.rejects(fetchGiosStations({ windowHours: 24, minHours: 18, attempts: 1, timeoutMs: 1000, fetchFn }));
});

const live: AirFile = {
  source: "t",
  fetched: "2026-10-04",
  note: "",
  windowHours: 24,
  stations: [{ id: 1, name: "A", lng: 19.9372, lat: 50.0614, pm10: 30, asOf: "2026-10-04 03:00:00" }],
};
const cell = latLngToCell(50.0614, 19.9372, 8);

test("live cells carry the window and the newest reading; a snapshot file does not", () => {
  const cells = airCells(live, [cell]);
  assert.equal(cells[cell].air.windowHours, 24);
  assert.equal(cells[cell].air.latest, "2026-10-04 03:00:00");
  assert.equal(newestReading(live), "2026-10-04 03:00:00");
  const snapshot: AirFile = { ...live, windowHours: undefined };
  assert.equal(airCells(snapshot, [cell])[cell].air.windowHours, undefined);
});

test("applyLiveAir replaces the score only for live data and only where a cell has one", () => {
  const hexes = [
    { h3Index: cell, air: 10 },
    { h3Index: "881e2e6ad9fffff", air: 55 },
  ];
  const body: LiveAirResponse = { source: "live", latest: null, cells: airCells(live, [cell]) };
  const out = applyLiveAir(hexes, body);
  assert.equal(out[0].air, body.cells[cell].score);
  assert.equal(out[1].air, 55);
  assert.equal(applyLiveAir(hexes, { ...body, source: "snapshot" }), hexes);
  assert.equal(applyLiveAir(hexes, null), hexes);
});

test("describeAir says it is a recent mean and when the newest reading was", () => {
  const air = airCells(live, [cell])[cell].air;
  const facts = describeAir({ air } as unknown as HexIndicators);
  assert.match(facts[0], /Średnia z ostatnich 24 godzin, najnowszy odczyt: 4 paź 2026, 03:00/);
});
