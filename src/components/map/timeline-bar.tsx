"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronDown, ExternalLink, X } from "lucide-react";
import { CERTAINTY_LABEL, TIMELINE_YEARS, fmtDay, type Certainty } from "@/lib/data/works";
import { cn } from "@/lib/utils";

export type TimelineCounts = { active: number; unknown: number; permits: number };

/** One work as listed in the bar: timing text comes from the stored dates, never from the distance or a guess. */
export type TimelineItem = {
  id: string;
  title: string;
  label: string;
  text: string;
  certainty: Certainty;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
};
export type TimelineList = { active: TimelineItem[]; unknown: TimelineItem[]; permits: TimelineItem[] };

const PILL: Record<string, string> = {
  "W trakcie": "bg-amber-100 text-amber-900",
  Planowane: "bg-sky-100 text-sky-900",
  "Wydano pozwolenie": "bg-slate-200 text-slate-800",
};

function Row({ item, selected, onSelect, rowRef }: { item: TimelineItem; selected: boolean; onSelect: () => void; rowRef: (el: HTMLLIElement | null) => void }) {
  return (
    <li ref={rowRef}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn("w-full rounded-lg border px-2.5 py-2 text-left text-xs leading-snug outline-none transition focus-visible:ring-2 focus-visible:ring-slate-400", selected ? "border-slate-900 bg-slate-50" : "border-transparent hover:bg-slate-50")}
      >
        <span className="flex items-start gap-2">
          <span className={cn("mt-px shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", PILL[item.label] ?? "bg-slate-100")}>{item.label}</span>
          <span className="font-medium text-slate-900">{item.title}</span>
        </span>
        <span className="mt-1 block text-slate-700">{item.text}</span>
        <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">{CERTAINTY_LABEL[item.certainty]}</span>
      </button>
      {selected && (
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mb-1 ml-2.5 inline-flex items-center gap-1 text-[11px] text-slate-600 underline-offset-2 hover:underline">
          Źródło: {item.sourceName}
          {item.publishedAt ? `, ${fmtDay(item.publishedAt)}` : ""}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      )}
    </li>
  );
}

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
  list,
  selectedId,
  onSelect,
}: {
  on: boolean;
  onToggle: () => void;
  year: number | null;
  onYear: (y: number | null) => void;
  counts: TimelineCounts | null;
  list: TimelineList | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  // Picking a work on the map opens the list so the user sees which entry it is.
  const [seenSelected, setSeenSelected] = useState<string | null>(null);
  if (selectedId !== seenSelected) {
    setSeenSelected(selectedId);
    if (selectedId) setListOpen(true);
  }
  const rows = useRef(new Map<string, HTMLLIElement>());
  useEffect(() => {
    if (selectedId && listOpen) rows.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId, listOpen]);
  const total = list ? list.active.length + list.unknown.length + list.permits.length : 0;
  const group = (title: string, items: TimelineItem[]) =>
    items.length === 0 ? null : (
      <div key={title} className="mt-2">
        <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <ul className="mt-1 space-y-0.5">
          {items.map((it) => (
            <Row
              key={it.id}
              item={it}
              selected={it.id === selectedId}
              onSelect={() => onSelect(it.id === selectedId ? null : it.id)}
              rowRef={(el) => {
                if (el) rows.current.set(it.id, el);
                else rows.current.delete(it.id);
              }}
            />
          ))}
        </ul>
      </div>
    );
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
      {list && total > 0 && (
        <>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="mt-2 flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            {listOpen ? "Ukryj listę" : `Pokaż listę (${total})`}
            <ChevronDown className={cn("size-4 transition-transform", listOpen && "rotate-180")} aria-hidden />
          </button>
          {listOpen && (
            <div className="mt-1 max-h-64 overflow-y-auto pr-1">
              {group(year === null ? "Trwają lub są planowane" : `Zgodnie ze źródłami w ${year} r.`, list.active)}
              {group("Termin nieznany", list.unknown)}
              {group(`Pozwolenia, brak harmonogramu (${list.permits.length})`, list.permits)}
            </div>
          )}
        </>
      )}
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Oficjalnie ogłoszone prace i decyzje, według terminów ze źródeł. To nie prognoza i nie zmienia wyniku dopasowania. Lista nie jest kompletna (np. metro nie jest uwzględnione).
      </p>
    </section>
  );
}
