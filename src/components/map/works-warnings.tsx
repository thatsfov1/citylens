"use client";

import { useMemo } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { fmtDay, summarizeWorks } from "@/lib/data/works";
import type { WorkNearby } from "@/types";
import { cn } from "@/lib/utils";

const LABEL_STYLE: Record<string, string> = {
  Ongoing: "bg-amber-100 text-amber-900",
  Planned: "bg-sky-100 text-sky-900",
};

/** Warning block: ongoing and planned works within ~1 km, each with its official source. Renders nothing if none. */
export function WorksWarnings({ works }: { works: WorkNearby[] }) {
  const summary = useMemo(() => summarizeWorks(works, new Date()), [works]);
  if (summary.warnings.length === 0) return null;

  return (
    <section className="mt-5 rounded-2xl border border-amber-300/70 bg-amber-50/70 p-3.5">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <TriangleAlert className="size-4" />
        Construction nearby
      </h3>
      <ul className="mt-2.5 space-y-3">
        {summary.warnings.map((w) => (
          <li key={w.id} className="text-xs leading-snug">
            <div className="flex items-start gap-2">
              <span className={cn("mt-px shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", LABEL_STYLE[w.label])}>
                {w.label}
              </span>
              <span className="font-medium text-slate-900">{w.title}</span>
            </div>
            <p className="mt-1 text-slate-700">{w.text}</p>
            <SourceLink name={w.sourceName} url={w.sourceUrl} asOf={w.publishedAt} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-amber-900/80">
        Dates come from the cited official announcements and may change. Timing is only shown when the source states it.
      </p>
    </section>
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
      Source: {name}
      {asOf ? `, ${fmtDay(asOf)}` : ""}
      <ExternalLink className="size-3" />
    </a>
  );
}
