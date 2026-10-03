import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { norm, verifyEvidence } from "../data/works-verify";

const page = norm("Prace potrwają\n do 16 grudnia 2026 r. w lesie Bonarka\n, w rejonie galerii.\n Zakończenie prac: 13 marca 2028 r.");
const base = { id: "x", dateFrom: null, dateTo: null, whenLabel: null, evidence: [] as string[] };

describe("verifyEvidence", () => {
  it("accepts quotes found on the page (despite stray HTML whitespace) with backed dates", () => {
    verifyEvidence({ ...base, dateTo: "2026-12-16", evidence: ["do 16 grudnia 2026 r. w lesie Bonarka, w rejonie galerii"] }, page);
  });

  it("rejects a quote that is not on the page", () => {
    assert.throws(() => verifyEvidence({ ...base, evidence: ["do 17 grudnia 2026 r."] }, page), /not found verbatim/);
  });

  it("rejects a date the quote does not state", () => {
    assert.throws(
      () => verifyEvidence({ ...base, dateTo: "2028-04-13", evidence: ["Zakończenie prac: 13 marca 2028 r."] }, page),
      /not backed/,
    );
  });

  it("rejects a record with no evidence", () => {
    assert.throws(() => verifyEvidence(base, page), /no evidence/);
  });
});
