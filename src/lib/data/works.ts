import { plPlural } from "../format/pl";
import type { WorkNearby } from "../../types";

// Turns stored works into warning sentences for the hexagon panel. Fully deterministic: every date and
// distance comes from the stored record (and its cited source); nothing is estimated beyond simple
// arithmetic on those dates. Timing the source did not state is never invented.

export const WORKS_RADIUS_M = 1000;

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

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

/**
 * "3 miesiące", "1 rok", "3 lata": whole years only for exactly 12 months or 24+.
 * `genitive` is for use after "około" ("około 3 miesięcy"); otherwise the accusative after "za około".
 */
const spanLabel = (months: number, genitive: boolean) => {
  if (months === 12 || months >= 24) {
    const years = Math.round(months / 12);
    return `${years} ${genitive ? plPlural(years, "roku", "lat", "lat") : plPlural(years, "rok", "lata", "lat")}`;
  }
  return `${months} ${genitive ? plPlural(months, "miesiąca", "miesięcy", "miesięcy") : plPlural(months, "miesiąc", "miesiące", "miesięcy")}`;
};

/** "za około 3 miesiące", "za około 1 rok", "w ciągu najbliższego miesiąca". */
export function relativeStart(fromIso: string, today: Date): string {
  const months = monthsBetween(toUtcDay(today), parse(fromIso));
  if (months < 1) return "w ciągu najbliższego miesiąca";
  return `za około ${spanLabel(months, false)}`;
}

/** "około 10 miesięcy" / "około 2 lat"; null when either bound is missing or the span is under a month. */
export function durationLabel(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso || !toIso) return null;
  const months = monthsBetween(parse(fromIso), parse(toIso));
  if (months < 1) return null;
  return `około ${spanLabel(months, true)}`;
}

export function distanceLabel(m: number): string {
  if (m < 100) return "w promieniu 100 m";
  return `~${Math.round(m / 50) * 50} m stąd`;
}

export type WorkWarning = {
  id: number;
  title: string;
  /** "W trakcie" | "Planowane" | "Wydano pozwolenie" */
  label: string;
  /** Distance + timing sentence, e.g. "~400 m stąd · planowane za około 1 rok (połowa 2027)". */
  text: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
  /** How firm the timing is, so official dates and vague wording look different. */
  certainty: Certainty;
};

/** True while the works are still relevant: planned/permits always, ongoing until their stated end date. */
export function isCurrent(w: Pick<WorkNearby, "status" | "dateTo">, today: Date): boolean {
  if (w.status === "ongoing" && w.dateTo) return parse(w.dateTo) >= toUtcDay(today);
  return true;
}

export function describeWork(w: WorkNearby, today: Date): WorkWarning {
  const dist = distanceLabel(w.distanceM);
  const base = { id: w.id, title: w.title, sourceName: w.sourceName, sourceUrl: w.sourceUrl, publishedAt: w.publishedAt, certainty: certainty(w) };

  if (w.status === "decision") {
    const when = w.dateFrom ? `wydane ${fmtMonth(w.dateFrom)}` : "wydane";
    return { ...base, label: "Wydano pozwolenie", text: `${dist} · pozwolenie ${when}; brak opublikowanego harmonogramu budowy` };
  }

  if (w.status === "planned") {
    const lead = w.dateFrom ? relativeStart(w.dateFrom, today) : null;
    const dur = durationLabel(w.dateFrom, w.dateTo);
    const parts = [
      lead ? `planowane ${lead}` : "planowane",
      w.whenLabel ? `(${w.whenLabel})` : w.dateFrom ? `(od ${fmtDay(w.dateFrom)})` : "",
      dur ? `potrwa ${dur}` : "",
    ].filter(Boolean);
    return { ...base, label: "Planowane", text: `${dist} · ${parts.join(" ")}` };
  }

  const started = w.dateFrom && parse(w.dateFrom) <= toUtcDay(today) ? `od ${fmtDay(w.dateFrom)}` : "";
  const until = w.whenLabel ?? (w.dateTo ? `do ${fmtDay(w.dateTo)}` : "źródło nie podaje daty zakończenia");
  const parts = ["w trakcie", started, until].filter(Boolean);
  return { ...base, label: "W trakcie", text: `${dist} · ${parts.join(", ")}` };
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

// ---- Timeline (informational: never feeds the match score) ----------------------------------------------------

/** Years offered on the timeline slider after "Dziś". */
export const TIMELINE_YEARS = [2027, 2028, 2029, 2030] as const;

export type WorkTime = Pick<WorkNearby, "status" | "dateFrom" | "dateTo" | "whenLabel">;

/**
 * permit      = a permit was issued, no works schedule is published (its date is the permit date, not the works)
 * approximate = the source gave vague timing ("around mid-2027"); the date we store is only an anchor
 * dated       = the source stated at least one date
 * none        = the source stated no timing at all
 */
export type Certainty = "permit" | "approximate" | "dated" | "none";

export function certainty(w: WorkTime): Certainty {
  if (w.status === "decision") return "permit";
  if (w.whenLabel) return "approximate";
  if (w.dateFrom || w.dateTo) return "dated";
  return "none";
}

export const CERTAINTY_LABEL: Record<Certainty, string> = {
  permit: "pozwolenie, brak harmonogramu",
  approximate: "termin orientacyjny",
  dated: "termin ze źródła",
  none: "brak terminu w źródle",
};

/**
 * active  = the stated dates cover that year (a planned item with only a start date counts in its start year only)
 * outside = the stated dates rule that year out (not started yet, or already finished)
 * unknown = we cannot tell: no dates, or it started earlier and no end is stated
 * permit  = permits carry no schedule, so they are never placed on a year
 */
export type YearPlacement = "active" | "outside" | "unknown" | "permit";

const yearOf = (iso: string) => Number(iso.slice(0, 4));

export function placeAtYear(w: WorkTime, year: number): YearPlacement {
  if (w.status === "decision") return "permit";
  const from = w.dateFrom ? yearOf(w.dateFrom) : null;
  const to = w.dateTo ? yearOf(w.dateTo) : null;
  if (from === null && to === null) return "unknown";
  if (to !== null) return (from === null || from <= year) && year <= to ? "active" : "outside";
  // Only a start is stated: it is certain in that year, ruled out before it, and open-ended after it.
  return year === from ? "active" : year < from! ? "outside" : "unknown";
}

export type YearView<T> = { active: T[]; unknown: T[]; permits: T[] };

/** Splits works for the selected year; `null` = "Dziś": everything still relevant today, as before. Pure and deterministic. */
export function worksAtYear<T extends WorkTime & Pick<WorkNearby, "dateTo">>(items: T[], year: number | null, today: Date): YearView<T> {
  const view: YearView<T> = { active: [], unknown: [], permits: [] };
  for (const w of items) {
    if (w.status === "decision") view.permits.push(w);
    else if (year === null) {
      if (isCurrent(w, today)) view.active.push(w);
    } else {
      const p = placeAtYear(w, year);
      if (p === "active") view.active.push(w);
      else if (p === "unknown") view.unknown.push(w);
    }
  }
  return view;
}

/** Year selected on the slider from the URL; anything but a listed year means "Dziś". */
export function parseYear(raw: string | null | undefined): number | null {
  const n = Number(raw);
  return (TIMELINE_YEARS as readonly number[]).includes(n) ? n : null;
}
