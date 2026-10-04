import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { certainty, describeWork, durationLabel, groupWorks, parseYear, placeAtYear, relativeStart, summarizeWorks, worksAtYear } from "../data/works";
import type { WorkNearby } from "../../types";

const today = new Date(2026, 9, 3); // 3 Oct 2026
const w = (o: Partial<WorkNearby>): WorkNearby => ({
  id: 1, title: "T", kind: "road", status: "planned", dateFrom: null, dateTo: null, whenLabel: null,
  sourceName: "ZDMK", sourceUrl: "https://example.org", publishedAt: null, distanceM: 410, ...o,
});

describe("works text", () => {
  it("relative start and duration come only from stored dates", () => {
    assert.equal(relativeStart("2027-01-01", today), "za około 3 miesiące");
    assert.equal(relativeStart("2029-10-01", today), "za około 3 lata");
    assert.equal(relativeStart("2026-10-20", today), "w ciągu najbliższego miesiąca");
    assert.equal(durationLabel("2029-06-01", "2030-06-01"), "około 1 roku");
    assert.equal(durationLabel("2029-06-01", null), null); // never invent a duration
  });

  it("planned works with a vague label keep the reviewed wording", () => {
    const d = describeWork(w({ dateFrom: "2027-07-01", whenLabel: "połowa 2027" }), today);
    assert.equal(d.label, "Planowane");
    assert.equal(d.text, "~400 m stąd · planowane za około 9 miesięcy (połowa 2027)");
  });

  it("planned works with start and end state the duration", () => {
    const d = describeWork(w({ dateFrom: "2029-10-01", dateTo: "2030-10-01" }), today);
    assert.equal(d.text, "~400 m stąd · planowane za około 3 lata (od 1 paź 2029) potrwa około 1 roku");
  });

  it("ongoing works show start and stated end", () => {
    const d = describeWork(w({ status: "ongoing", dateFrom: "2026-08-27", dateTo: "2026-11-30", distanceM: 80 }), today);
    assert.equal(d.text, "w promieniu 100 m · w trakcie, od 27 sie 2026, do 30 lis 2026");
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

describe("timeline", () => {
  const t = (o: Partial<WorkNearby>) => w({ status: "planned", ...o });

  it("certainty separates permits, vague wording, stated dates and nothing", () => {
    assert.equal(certainty(t({ status: "decision", dateFrom: "2025-01-01" })), "permit");
    assert.equal(certainty(t({ dateFrom: "2027-07-01", whenLabel: "mid-2027" })), "approximate");
    assert.equal(certainty(t({ dateFrom: "2027-07-01" })), "dated");
    assert.equal(certainty(t({})), "none");
  });

  it("a range is active in every year it covers, inclusive, and outside otherwise", () => {
    const r = t({ status: "ongoing", dateFrom: "2026-07-06", dateTo: "2028-03-13" });
    assert.equal(placeAtYear(r, 2027), "active");
    assert.equal(placeAtYear(r, 2028), "active");
    assert.equal(placeAtYear(r, 2029), "outside");
    assert.equal(placeAtYear(t({ dateTo: "2028-03-13" }), 2027), "active"); // started earlier, only the end is stated
  });

  it("a start-only item is certain in its start year and never extended afterwards", () => {
    const r = t({ dateFrom: "2027-07-01" });
    assert.equal(placeAtYear(r, 2026), "outside");
    assert.equal(placeAtYear(r, 2027), "active");
    assert.equal(placeAtYear(r, 2029), "unknown");
  });

  it("undated items and permits are never placed on a year", () => {
    assert.equal(placeAtYear(t({}), 2028), "unknown");
    assert.equal(placeAtYear(t({ status: "decision", dateFrom: "2028-01-01" }), 2028), "permit");
  });

  it("worksAtYear: Dziś keeps everything current, a year filters, permits stay apart", () => {
    const items = [
      t({ id: 1, status: "ongoing", dateFrom: "2026-01-16", dateTo: "2027-12-31" }),
      t({ id: 2, dateFrom: "2029-01-01" }),
      t({ id: 3 }),
      t({ id: 4, status: "ongoing", dateTo: "2026-01-01" }), // finished before today
      t({ id: 5, status: "decision" }),
    ];
    const now = worksAtYear(items, null, today);
    assert.deepEqual(now.active.map((x) => x.id), [1, 2, 3]);
    assert.deepEqual(now.permits.map((x) => x.id), [5]);
    const y = worksAtYear(items, 2029, today);
    assert.deepEqual(y.active.map((x) => x.id), [2]);
    assert.deepEqual(y.unknown.map((x) => x.id), [3]);
  });

  it("parseYear only accepts the slider's years", () => {
    assert.equal(parseYear("2028"), 2028);
    assert.equal(parseYear("2031"), null);
    assert.equal(parseYear(null), null);
    assert.equal(parseYear("abc"), null);
  });
});

describe("works map layer", () => {
  it("the built GeoJSON validates and every feature cites a source", async () => {
    const { loadWorksMap } = await import("../data/works-map");
    const fc = loadWorksMap();
    assert.ok(fc.features.length >= 12);
    for (const f of fc.features) {
      assert.match(f.properties.sourceUrl, /^https?:\/\//);
      assert.ok(f.geometry.type);
    }
    assert.ok(fc.features.some((f) => f.properties.status === "decision"));
  });
});
