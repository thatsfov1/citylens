import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeWork, durationLabel, groupWorks, relativeStart, summarizeWorks } from "../data/works";
import type { WorkNearby } from "../../types";

const today = new Date(2026, 9, 3); // 3 Oct 2026
const w = (o: Partial<WorkNearby>): WorkNearby => ({
  id: 1, title: "T", kind: "road", status: "planned", dateFrom: null, dateTo: null, whenLabel: null,
  sourceName: "ZDMK", sourceUrl: "https://example.org", publishedAt: null, distanceM: 410, ...o,
});

describe("works text", () => {
  it("relative start and duration come only from stored dates", () => {
    assert.equal(relativeStart("2027-01-01", today), "in about 3 months");
    assert.equal(relativeStart("2029-10-01", today), "in about 3 years");
    assert.equal(relativeStart("2026-10-20", today), "within the next month");
    assert.equal(durationLabel("2029-06-01", "2030-06-01"), "about 1 year");
    assert.equal(durationLabel("2029-06-01", null), null); // never invent a duration
  });

  it("planned works with a vague label keep the reviewed wording", () => {
    const d = describeWork(w({ dateFrom: "2027-07-01", whenLabel: "around mid-2027" }), today);
    assert.equal(d.label, "Planned");
    assert.equal(d.text, "~400 m away · planned in about 9 months (around mid-2027)");
  });

  it("planned works with start and end state the duration", () => {
    const d = describeWork(w({ dateFrom: "2029-10-01", dateTo: "2030-10-01" }), today);
    assert.equal(d.text, "~400 m away · planned in about 3 years (from 1 Oct 2029) lasting about 1 year");
  });

  it("ongoing works show start and stated end", () => {
    const d = describeWork(w({ status: "ongoing", dateFrom: "2026-08-27", dateTo: "2026-11-30", distanceM: 80 }), today);
    assert.equal(d.text, "within 100 m · under way, since 27 Aug 2026, until 30 Nov 2026");
  });

  it("drops ended works, collapses permits and orders ongoing before planned", () => {
    const s = summarizeWorks(
      [
        w({ id: 1, status: "ongoing", dateTo: "2026-09-01" }), // ended
        w({ id: 2, status: "planned", dateFrom: "2028-01-01" }),
        w({ id: 3, status: "ongoing", dateTo: "2026-12-01", distanceM: 900 }),
        w({ id: 4, status: "decision", dateFrom: "2026-06-01", distanceM: 200 }),
        w({ id: 5, status: "decision", dateFrom: "2026-05-01", distanceM: 600 }),
      ],
      today,
    );
    assert.deepEqual(s.warnings.map((x) => x.id), [3, 2]);
    assert.equal(s.permits?.count, 2);
    assert.equal(s.permits?.nearestM, 200);
  });
});

describe("groupWorks", () => {
  it("groups by status without a cap, orders planned by start, drops ended works", () => {
    const g = groupWorks(
      [
        w({ id: 1, status: "ongoing", dateTo: "2026-09-01" }), // ended
        w({ id: 2, status: "ongoing", distanceM: 700 }),
        w({ id: 3, status: "ongoing", distanceM: 90 }),
        w({ id: 4, status: "planned", dateFrom: "2028-01-01" }),
        w({ id: 5, status: "planned", dateFrom: "2027-01-01" }),
        w({ id: 6, status: "planned" }), // no stated start: last
        w({ id: 7, status: "decision", distanceM: 300 }),
        w({ id: 8, status: "decision", distanceM: 120 }),
      ],
      today,
    );
    assert.deepEqual(g.ongoing.map((x) => x.id), [3, 2]);
    assert.deepEqual(g.planned.map((x) => x.id), [5, 4, 6]);
    assert.equal(g.permits?.count, 2);
    assert.equal(g.permits?.nearestM, 120);
  });
});
