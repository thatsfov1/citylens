"use client";

import { CalendarRange, X } from "lucide-react";
import { TIMELINE_YEARS } from "@/lib/data/works";
import { cn } from "@/lib/utils";

export type TimelineCounts = { active: number; unknown: number; permits: number };

/**
 * "Plany miasta": a year picker that filters the official works / plans / permits on the map.
 * Informational only — the match score never changes with the year, and the bar says so.
 */
export function TimelineBar({
  on,
  onToggle,
  year,
  onYear,
  counts,
}: {
  on: boolean;
  onToggle: () => void;
  year: number | null;
  onYear: (y: number | null) => void;
  counts: TimelineCounts | null;
}) {
  if (!on) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="absolute bottom-[4.5rem] left-1/2 z-[5] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/70 bg-white/95 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur hover:bg-white sm:bottom-20"
      >
        <CalendarRange className="size-4" aria-hidden />
        Plany miasta
      </button>
    );
  }
  const stops: { label: string; value: number | null }[] = [{ label: "Dziś", value: null }, ...TIMELINE_YEARS.map((y) => ({ label: String(y), value: y }))];
  return (
    <section
      aria-label="Plany i prace w mieście"
      className="absolute bottom-[4.5rem] left-1/2 z-[5] w-[min(26rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-border/70 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-20"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarRange className="size-4" aria-hidden />
          Plany i prace w mieście
        </h2>
        <button type="button" onClick={onToggle} aria-label="Zamknij oś czasu" className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div role="radiogroup" aria-label="Rok" className="relative mt-3 flex justify-between">
        <span aria-hidden className="absolute left-4 right-4 top-[9px] h-px bg-border" />
        {stops.map((s) => {
          const selected = s.value === year;
          return (
            <button
              key={s.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onYear(s.value)}
              className="relative flex w-12 flex-col items-center gap-1 text-xs outline-none focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-slate-400"
            >
              <span className={cn("size-[18px] rounded-full border-2 bg-white transition", selected ? "border-slate-900 bg-slate-900" : "border-slate-400 hover:border-slate-700")} />
              <span className={selected ? "font-semibold text-slate-900" : "text-muted-foreground"}>{s.label}</span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-2 text-xs text-slate-700">
        {counts
          ? `${counts.active} ${year === null ? "bieżących" : `w ${year}`} · ${counts.unknown} z nieznanym terminem · ${counts.permits} pozwoleń bez harmonogramu`
          : "Wczytuję plany…"}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Oficjalnie ogłoszone prace i decyzje, według terminów ze źródeł. To nie prognoza i nie zmienia wyniku dopasowania. Lista nie jest kompletna (np. metro nie jest uwzględnione).
      </p>
    </section>
  );
}
