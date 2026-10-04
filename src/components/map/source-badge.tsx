"use client";

import { Popover } from "@base-ui/react/popover";
import { ExternalLink } from "lucide-react";
import { KIND_LABEL, SOURCES, SOURCES_BY_TOPIC, formatAsOf, type AsOf, type SourceId, type SourceKind, type SourceTopic } from "@/lib/sources";
import { cn } from "@/lib/utils";

const DOT: Record<SourceKind, string> = {
  measured: "bg-emerald-500",
  official: "bg-sky-500",
  listing: "bg-amber-500",
  routing: "bg-violet-500",
};

/** Chip naming a data source and its date; opens a card with what it provides, the licence and a link. */
export function SourceBadge({ id, asOf }: { id: SourceId; asOf?: AsOf }) {
  const s = SOURCES[id];
  const date = formatAsOf(asOf !== undefined ? asOf : s.asOf);
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Źródło: ${s.label}, ${date}. Pokaż szczegóły`}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2 py-0.5 text-[11px] leading-5 text-slate-700 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <span aria-hidden className={cn("size-1.5 rounded-full", DOT[s.kind])} />
        <span className="font-medium">{s.short}</span>
        <span className="text-muted-foreground">{date}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-[60]">
          <Popover.Popup className="w-64 rounded-lg border border-border bg-white p-3 text-xs leading-snug text-slate-700 shadow-lg outline-none">
            <Popover.Title className="text-sm font-semibold text-slate-900">{s.label}</Popover.Title>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{KIND_LABEL[s.kind]}</p>
            <Popover.Description className="mt-2">{s.provides}</Popover.Description>
            <dl className="mt-2 space-y-0.5">
              <div className="flex gap-1">
                <dt className="text-muted-foreground">Stan danych:</dt>
                <dd>{date}</dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-muted-foreground">Licencja:</dt>
                <dd>{s.license}</dd>
              </div>
            </dl>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
              Otwórz źródło
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Row of badges for one topic (category, air, rent…); `asOf` overrides the date per source where a dataset has its own. */
export function SourceBadges({ topic, asOf, className }: { topic: SourceTopic; asOf?: Partial<Record<SourceId, AsOf>>; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Źródła</span>
      {SOURCES_BY_TOPIC[topic].map((id) => (
        <SourceBadge key={id} id={id} asOf={asOf?.[id]} />
      ))}
    </div>
  );
}
