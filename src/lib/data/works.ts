import type { WorkNearby } from "../../types";

// Turns stored works into warning sentences for the hexagon panel. Fully deterministic: every date and
// distance comes from the stored record (and its cited source); nothing is estimated beyond simple
// arithmetic on those dates. Timing the source did not state is never invented.

export const WORKS_RADIUS_M = 1000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const fmtDay = (iso: string) => {
  const d = parse(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const fmtMonth = (iso: string) => {
  const d = parse(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const monthsBetween = (a: Date, b: Date) =>
  (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());

export const toUtcDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** "3 months", "1 year", "3 years": whole years only for exactly 12 months or 24+. */
const spanLabel = (months: number) =>
  months === 12 || months >= 24 ? plural(Math.round(months / 12), "year") : plural(months, "month");

/** "in about 3 months", "in about 1 year", "within the next month". */
export function relativeStart(fromIso: string, today: Date): string {
  const months = monthsBetween(toUtcDay(today), parse(fromIso));
  if (months < 1) return "within the next month";
  return `in about ${spanLabel(months)}`;
}

/** "about 10 months" / "about 2 years"; null when either bound is missing or the span is under a month. */
export function durationLabel(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso || !toIso) return null;
  const months = monthsBetween(parse(fromIso), parse(toIso));
  if (months < 1) return null;
  return `about ${spanLabel(months)}`;
}

export function distanceLabel(m: number): string {
  if (m < 100) return "within 100 m";
  return `~${Math.round(m / 50) * 50} m away`;
}

export type WorkWarning = {
  id: number;
  title: string;
  /** "Ongoing" | "Planned" | "Permit issued" */
  label: string;
  /** Distance + timing sentence, e.g. "~400 m away · planned in about 1 year (around mid-2027)". */
  text: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
};

/** True while the works are still relevant: planned/permits always, ongoing until their stated end date. */
export function isCurrent(w: WorkNearby, today: Date): boolean {
  if (w.status === "ongoing" && w.dateTo) return parse(w.dateTo) >= toUtcDay(today);
  return true;
}

export function describeWork(w: WorkNearby, today: Date): WorkWarning {
  const dist = distanceLabel(w.distanceM);
  const base = { id: w.id, title: w.title, sourceName: w.sourceName, sourceUrl: w.sourceUrl, publishedAt: w.publishedAt };

  if (w.status === "decision") {
    const when = w.dateFrom ? `issued ${fmtMonth(w.dateFrom)}` : "issued";
    return { ...base, label: "Permit issued", text: `${dist} · permit ${when}; no construction schedule published` };
  }

  if (w.status === "planned") {
    const lead = w.dateFrom ? relativeStart(w.dateFrom, today) : null;
    const dur = durationLabel(w.dateFrom, w.dateTo);
    const parts = [
      lead ? `planned ${lead}` : "planned",
      w.whenLabel ? `(${w.whenLabel})` : w.dateFrom ? `(from ${fmtDay(w.dateFrom)})` : "",
      dur ? `lasting ${dur}` : "",
    ].filter(Boolean);
    return { ...base, label: "Planned", text: `${dist} · ${parts.join(" ")}` };
  }

  const started = w.dateFrom && parse(w.dateFrom) <= toUtcDay(today) ? `since ${fmtDay(w.dateFrom)}` : "";
  const until = w.whenLabel ?? (w.dateTo ? `until ${fmtDay(w.dateTo)}` : "end date not stated by the source");
  const parts = ["under way", started, until].filter(Boolean);
  return { ...base, label: "Ongoing", text: `${dist} · ${parts.join(", ")}` };
}

export type WorksSummary = {
  warnings: WorkWarning[];
  /** Permits are many and carry no schedule, so they are summarised rather than listed. */
  permits: { count: number; nearestM: number; sourceName: string; sourceUrl: string } | null;
};

/** Current works first (ongoing by distance, then planned by start date), permits collapsed into one line. */
export function summarizeWorks(works: WorkNearby[], today: Date, max = 4): WorksSummary {
  const current = works.filter((w) => isCurrent(w, today));
  const rank = (w: WorkNearby) => (w.status === "ongoing" ? 0 : 1);
  const listed = current
    .filter((w) => w.status !== "decision")
    .sort((a, b) =>
      rank(a) - rank(b) ||
      (a.status === "planned" && b.status === "planned"
        ? (a.dateFrom ?? "9999").localeCompare(b.dateFrom ?? "9999")
        : a.distanceM - b.distanceM),
    );
  const permits = current.filter((w) => w.status === "decision");
  return {
    warnings: listed.slice(0, max).map((w) => describeWork(w, today)),
    permits: permits.length
      ? {
          count: permits.length,
          nearestM: Math.min(...permits.map((p) => p.distanceM)),
          sourceName: permits[0].sourceName,
          sourceUrl: permits[0].sourceUrl,
        }
      : null,
  };
}

export type WorksGroups = {
  /** Under way now, nearest first. */
  ongoing: WorkWarning[];
  /** Officially planned, earliest start first; works without a stated start come last. */
  planned: WorkWarning[];
  /** Permits: an investment is being prepared but no schedule is published. */
  permits: WorksSummary["permits"];
};

/** Time view of the same records: what is under way, what is planned, what only has a permit. Nothing is capped or invented. */
export function groupWorks(works: WorkNearby[], today: Date): WorksGroups {
  const current = works.filter((w) => isCurrent(w, today));
  const ongoing = current.filter((w) => w.status === "ongoing").sort((a, b) => a.distanceM - b.distanceM);
  const planned = current
    .filter((w) => w.status === "planned")
    .sort((a, b) => (a.dateFrom ?? "9999").localeCompare(b.dateFrom ?? "9999") || a.distanceM - b.distanceM);
  return {
    ongoing: ongoing.map((w) => describeWork(w, today)),
    planned: planned.map((w) => describeWork(w, today)),
    permits: summarizeWorks(works, today, 0).permits,
  };
}
