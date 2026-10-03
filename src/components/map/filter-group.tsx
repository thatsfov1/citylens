"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  title: string;
  icon: ReactNode;
  /** The current value in a few words ("Off", "2 000 – 3 500 zł"). */
  summary: string;
  /** Highlights the summary when the filter changes the map. */
  active: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** One collapsible group of the Filters window: a header with its current value, and the controls underneath. */
export function FilterGroup({ title, icon, summary, active, open, onToggle, children }: Props) {
  const id = useId();
  return (
    <section className="py-1">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left hover:bg-muted/60"
        >
          <span className="text-muted-foreground">{icon}</span>
          <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</span>
          <span
            className={`max-w-[11rem] truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${
              active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
            }`}
          >
            {summary}
          </span>
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </h3>
      <div id={id} hidden={!open} className="px-1 pb-3 pt-1">
        {children}
      </div>
    </section>
  );
}
