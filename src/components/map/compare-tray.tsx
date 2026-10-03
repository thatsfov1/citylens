import { X } from "lucide-react";
import type { Comparison } from "@/lib/scoring/compare";
import { CATEGORY_LABELS } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  comparison: Comparison;
  selected: string | null;
  onSelect: (h3Index: string) => void;
  onRemove: (h3Index: string) => void;
  onClear: () => void;
};

/** Side-by-side category scores for up to three areas the user is considering. Tap a column to open that area. */
export function CompareTray({ comparison, selected, onSelect, onRemove, onClear }: Props) {
  const { areas, rows, matchLeads } = comparison;
  if (areas.length === 0) return null;
  return (
    <section className="border-b border-border/70 px-5 py-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comparing {areas.length}</div>
        <button onClick={onClear} className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
          Clear
        </button>
      </div>
      <table className="mt-2 w-full table-fixed text-xs">
        <thead>
          <tr>
            <th className="w-[26%]" />
            {areas.map((a, i) => (
              <th key={a.h3Index} className="px-0.5 pb-1 align-top font-medium">
                <div className="flex items-start justify-center gap-0.5">
                  <button
                    onClick={() => onSelect(a.h3Index)}
                    className={cn("truncate rounded px-1 py-0.5 hover:bg-muted", selected === a.h3Index && "bg-muted font-semibold")}
                    title={a.district ?? `Area ${i + 1}`}
                  >
                    {a.district ?? `Area ${i + 1}`}
                  </button>
                  <button onClick={() => onRemove(a.h3Index)} aria-label="Remove from comparison" className="rounded p-0.5 text-muted-foreground hover:bg-muted">
                    <X className="size-3" />
                  </button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/70">
            <td className="py-1 text-muted-foreground">Match</td>
            {areas.map((a, i) => (
              <td key={a.h3Index} className={cn("py-1 text-center text-sm tabular-nums", matchLeads[i] ? "font-semibold text-emerald-700" : "")}>
                {a.match}%
              </td>
            ))}
          </tr>
          {rows.map((r) => (
            <tr key={r.category} className="border-t border-border/40">
              <td className="py-0.5 text-muted-foreground">{CATEGORY_LABELS[r.category]}</td>
              {r.values.map((v, i) => (
                <td key={areas[i].h3Index} className={cn("py-0.5 text-center tabular-nums", r.leads[i] && "font-semibold text-emerald-700")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        Green marks the higher score in each row. A lower score is a different fit, not a worse place.
      </p>
    </section>
  );
}
