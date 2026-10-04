"use client";

import { useMemo } from "react";
import { plPlural } from "@/lib/format/pl";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { CERTAINTY_LABEL, describeWork, fmtDay, groupWorks, worksAtYear, type WorkWarning } from "@/lib/data/works";
import type { WorkNearby } from "@/types";
import { cn } from "@/lib/utils";

const LABEL_STYLE: Record<string, string> = {
  "W trakcie": "bg-amber-100 text-amber-900",
  Planowane: "bg-sky-100 text-sky-900",
};

/** Time view of works within ~1 km: under way, planned, and permits without a schedule. Each with its official source. Renders nothing if none. */
export function WorksWarnings({ works, year = null }: { works: WorkNearby[]; year?: number | null }) {
  const groups = useMemo(() => {
    const today = new Date();
    const base = groupWorks(works, today);
    if (year === null) return { ...base, unknown: [] as WorkWarning[] };
    // Timeline year: only what the stated dates place in that year; the rest is listed apart, never guessed.
    const v = worksAtYear(works, year, today);
    const byDistance = (a: WorkNearby, b: WorkNearby) => a.distanceM - b.distanceM;
    return {
      ongoing: v.active.sort(byDistance).map((w) => describeWork(w, today)),
      planned: [] as WorkWarning[],
      permits: base.permits,
      unknown: v.unknown.sort(byDistance).map((w) => describeWork(w, today)),
    };
  }, [works, year]);
  if (groups.ongoing.length === 0 && groups.planned.length === 0 && groups.unknown.length === 0) return null;

  return (
    <section className="mt-5 rounded-2xl border border-amber-300/70 bg-amber-50/70 p-3.5">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <TriangleAlert className="size-4" />
        Co zmienia się w okolicy
      </h3>
      <Group title={year === null ? "Trwają teraz" : `Zgodnie ze źródłami w ${year} r.`} items={groups.ongoing} />
      <Group title="Planowane" items={groups.planned} />
      <Group title="Termin nieznany" items={groups.unknown} />
      {groups.permits && (
        <div className="mt-3.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/80">Wydano pozwolenie, brak harmonogramu</h4>
          <p className="mt-1 text-xs leading-snug text-slate-700">
            {groups.permits.count} {plPlural(groups.permits.count, "decyzja", "decyzje", "decyzji")} o wycince drzew związanej z inwestycją w promieniu 1 km (najbliższa ok.{" "}
            {Math.round(groups.permits.nearestM / 50) * 50} m). Inwestycja jest przygotowywana; nie opublikowano terminów budowy.
          </p>
          <SourceLink name={groups.permits.sourceName} url={groups.permits.sourceUrl} asOf={null} />
        </div>
      )}
      <p className="mt-3 text-[11px] leading-snug text-amber-900/80">
        Terminy pochodzą z przytoczonych oficjalnych ogłoszeń i mogą się zmienić. To tylko informacja: nie wpływa na wynik dopasowania.
      </p>
    </section>
  );
}

function Group({ title, items }: { title: string; items: WorkWarning[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/80">{title}</h4>
      <ul className="mt-1.5 space-y-3">
        {items.map((w) => (
          <li key={w.id} className="text-xs leading-snug">
            <div className="flex items-start gap-2">
              <span className={cn("mt-px shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", LABEL_STYLE[w.label])}>
                {w.label}
              </span>
              <span className="font-medium text-slate-900">{w.title}</span>
            </div>
            <p className="mt-1 text-slate-700">{w.text}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-amber-900/70">{CERTAINTY_LABEL[w.certainty]}</p>
            <SourceLink name={w.sourceName} url={w.sourceUrl} asOf={w.publishedAt} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceLink({ name, url, asOf }: { name: string; url: string; asOf: string | null }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-600 underline-offset-2 hover:underline"
    >
      Źródło: {name}
      {asOf ? `, ${fmtDay(asOf)}` : ""}
      <ExternalLink className="size-3" />
    </a>
  );
}
