import assert from "node:assert/strict";
import { test } from "node:test";
import { latLngToCell } from "h3-js";
import { CENTRE, runChecks } from "../../../scripts/sanity/checks";
import { readSeed } from "../../../scripts/sanity/seed";

// The stored scores are checked against common knowledge of Kraków (see scripts/sanity/checks.ts).
// Run `npx tsx scripts/sanity/report.ts` for the full report with district rankings.
const rows = readSeed();

test("the committed seed passes every sanity check", () => {
  const failed = runChecks(rows).filter((c) => !c.ok);
  assert.deepEqual(failed.map((c) => `${c.name} (${c.detail})`), []);
});

test("the checks can fail: wiping the Old Town's culture and transport is caught", () => {
  const centre = latLngToCell(CENTRE[0], CENTRE[1], 8);
  const broken = rows.map((r) => (r.h3 === centre ? { ...r, scores: { ...r.scores, culture: 0, transport: 0 } } : r));
  const failed = runChecks(broken).filter((c) => !c.ok).map((c) => c.name);
  assert.ok(failed.some((n) => n.startsWith("Rynek Główny: culture")));
  assert.ok(failed.some((n) => n.startsWith("Rynek Główny: transport")));
});
