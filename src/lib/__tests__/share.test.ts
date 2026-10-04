import assert from "node:assert/strict";
import { test } from "node:test";
import { latLngToCell } from "h3-js";
import { MAX_SAVED, SAVED_KEY, deleteSaved, loadSaved, saveMap } from "../share/saved";
import { applyShareState, buildShareUrl, parseShareState, rentPhrase, savedQuery, topPreferences } from "../share/state";

const cell = (lat: number, lng: number) => latLngToCell(lat, lng, 8);
const A = cell(50.06, 19.94);
const B = cell(50.07, 19.95);
const C = cell(50.05, 19.93);
const D = cell(50.04, 19.92);

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

test("mode, sel and cmp round trip through the query", () => {
  const state = { mode: "greenery" as const, selected: A, compared: [B, C] };
  const search = applyShareState("greenery=100&minSafety=50", state).toString();
  assert.deepEqual(parseShareState(Object.fromEntries(new URLSearchParams(search))), { ...state, shared: false });
  // Existing filters stay untouched.
  assert.match(search, /^greenery=100&minSafety=50&mode=greenery&sel=/);
});

test("the default tab and empty selections are not written", () => {
  const q = applyShareState("sport=50", { mode: "forYou", selected: null, compared: [] }).toString();
  assert.equal(q, "sport=50");
});

test("invalid input is dropped, never thrown", () => {
  const grid = new Set([A, B]);
  const parsed = parseShareState({ mode: "weird", sel: "not-a-cell", cmp: `${A},${A},${C},zzz,${B}` }, grid);
  assert.equal(parsed.mode, "forYou");
  assert.equal(parsed.selected, null);
  assert.deepEqual(parsed.compared, [A, B]); // deduplicated; C is valid H3 but not in the loaded grid
  assert.deepEqual(parseShareState({}, grid), { mode: "forYou", selected: null, compared: [], shared: false });
});

test("at most three compared areas are kept", () => {
  assert.equal(parseShareState({ cmp: [A, B, C, D].join(",") }).compared.length, 3);
  assert.equal(applyShareState("", { mode: "forYou", selected: null, compared: [A, B, C, D] }).get("cmp")?.split(",").length, 3);
});

test("the order of parameters is stable and the receiver marker is only on built links", () => {
  const state = { mode: "safety" as const, selected: A, compared: [B] };
  const url = buildShareUrl("https://x.test", "sport=50&shared=0&sel=old", state);
  assert.equal(url, `https://x.test/map?sport=50&mode=safety&sel=${A}&cmp=${B}&shared=1`);
  assert.equal(parseShareState(Object.fromEntries(new URL(url).searchParams)).shared, true);
  assert.ok(!savedQuery("sport=50", state).includes("shared"));
});

test("summaries for previews", () => {
  const imp = { sport: 0, culture: 10, greenery: 100, shopping: 0, transport: 75, education: 0 };
  assert.deepEqual(topPreferences(imp), ["zieleń 100%", "transport 75%", "kultura 10%"]);
  assert.equal(rentPhrase(null), null);
  assert.equal(rentPhrase({ min: 1500, max: 3500, rooms: 2, fees: true }), "czynsz do 3 500 zł");
  assert.equal(rentPhrase({ min: 2000, max: 3500, rooms: 2, fees: false }), "czynsz 2 000 zł – 3 500 zł (bez opłat)");
});

test("saved maps: newest first, replace the same query, cap at ten", () => {
  const store = memory();
  saveMap({ name: "First", query: "a=1" }, 1000, store);
  saveMap({ name: "Second", query: "a=2" }, 2000, store);
  const again = saveMap({ name: "First again", query: "a=1" }, 3000, store);
  assert.deepEqual(again.list.map((s) => s.name), ["First again", "Second"]);
  for (let i = 0; i < 15; i++) saveMap({ name: `m${i}`, query: `b=${i}` }, 4000 + i, store);
  assert.equal(loadSaved(store).length, MAX_SAVED);
  assert.equal(loadSaved(store)[0].name, "m14");
});

test("saved maps: delete, long names, corrupt and missing storage", () => {
  const store = memory();
  const { list } = saveMap({ name: "x".repeat(200), query: "q=1" }, 5, store);
  assert.equal(list[0].name.length, 60);
  assert.deepEqual(deleteSaved(list[0].id, store), []);
  store.data.set(SAVED_KEY, "{not json");
  assert.deepEqual(loadSaved(store), []);
  store.data.set(SAVED_KEY, JSON.stringify([{ id: "ok", name: "n", createdAt: 1, query: "" }, { bad: true }]));
  assert.equal(loadSaved(store).length, 1);
  assert.deepEqual(loadSaved(null), []);
  assert.equal(saveMap({ name: "n", query: "q" }, 1, null).ok, false);
  const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(loadSaved(throwing), []);
  assert.equal(saveMap({ name: "n", query: "q" }, 1, throwing).ok, false);
});

test("the car switch rides along in shared links and saved maps", () => {
  const state = { mode: "forYou" as const, selected: A, compared: [] };
  assert.match(buildShareUrl("https://x.test", "sport=50&car=1", state), /[?&]car=1/);
  assert.match(savedQuery("sport=50&car=1", state), /car=1/);
});
