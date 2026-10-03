import assert from "node:assert/strict";
import { test } from "node:test";
import { educationScore, parseStages, stagesToParam, withEducationStages } from "../scoring/education";
import type { HexData } from "../../types";

const hex: HexData = {
  h3Index: "x",
  scores: { sport: 0, culture: 0, greenery: 0, shopping: 0, transport: 0, education: 50 },
  educationStages: { kindergarten: 100, primary: 60, secondary: 40, university: 0 },
};

test("parseStages: default is every stage, unknown codes ignored", () => {
  assert.equal(parseStages(null).length, 4);
  assert.deepEqual(parseStages("kg,pr"), ["kindergarten", "primary"]);
  assert.equal(parseStages("zz").length, 4);
});

test("stagesToParam round-trips and omits the default", () => {
  assert.equal(stagesToParam(parseStages(null)), null);
  assert.equal(stagesToParam(["secondary", "kindergarten"]), "kg,se"); // canonical order
  assert.deepEqual(parseStages(stagesToParam(["university"])), ["university"]);
});

test("educationScore: mean of selected stages; stored score when all or no stage data", () => {
  assert.equal(educationScore(hex, ["kindergarten"]), 100);
  assert.equal(educationScore(hex, ["kindergarten", "university"]), 50);
  assert.equal(educationScore(hex, ["kindergarten", "primary", "secondary", "university"]), 50);
  assert.equal(educationScore({ scores: hex.scores }, ["kindergarten"]), 50); // mock data has no stages
});

test("withEducationStages leaves other categories untouched", () => {
  const [out] = withEducationStages([hex], ["university"]);
  assert.equal(out.scores.education, 0);
  assert.equal(out.scores.sport, 0);
  assert.equal(hex.scores.education, 50); // input not mutated
});
