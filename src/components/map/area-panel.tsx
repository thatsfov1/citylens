"use client";

import { Check, Info, MapPin, X } from "lucide-react";
import { explainMatch, type MatchLevel } from "@/lib/scoring/explain";
import { describeAll } from "@/lib/scoring/facts";
import type { HexSource } from "@/lib/supabase/hex-scores";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type CategoryScores,
  type CategoryWeights,
  type HexIndicators,
} from "@/types";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<MatchLevel, string> = {
  strong: "text-emerald-700",
  moderate: "text-amber-600",
  weak: "text-orange-600",
};

type Props = {
  scores: CategoryScores | null;
  district: string | null;
  indicators: HexIndicators | null;
  source: HexSource;
  weights: CategoryWeights;
  onClose: () => void;
};

export function AreaPanel({ scores, district, indicators, source, weights, onClose }: Props) {
  const byWeight = [...CATEGORIES].sort((a, b) => weights[b] - weights[a]);

  if (!scores) {
    return (
      <div className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="size-4 text-emerald-600" />
          Click a hexagon to see how it matches you
        </div>
        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          We understood
        </h3>
        <ul className="mt-3 space-y-2.5">
          {byWeight.map((c) => (
            <li key={c} className="text-sm">
              <div className="flex justify-between">
                <span>{CATEGORY_LABELS[c]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(weights[c] * 100)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${weights[c] * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Only clearly stronger or weaker matches are tinted; hover any area to
          explore it. A weaker match is not a worse place, just a different fit.
        </p>
      </div>
    );
  }

  const facts = indicators ? describeAll(indicators) : undefined;
  const ex = explainMatch(scores, weights, facts);

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Area match{district ? ` · ${district}` : ""}
          </div>
          <div className={cn("mt-1 text-5xl font-semibold tabular-nums", LEVEL_STYLE[ex.level])}>
            {ex.score}%
          </div>
          <div className="mt-1 text-sm font-medium">{ex.headline}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <ul className="mt-5 space-y-3">
        {byWeight.map((c) => (
          <li key={c} className="text-sm">
            <div className="flex justify-between">
              <span>
                {CATEGORY_LABELS[c]}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  weight {Math.round(weights[c] * 100)}%
                </span>
              </span>
              <span className="font-semibold tabular-nums">{scores[c]}</span>
            </div>
            {facts && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{facts[c]}</p>}
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-slate-800 transition-all"
                style={{ width: `${scores[c]}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-sm font-semibold">Why it matches you</h3>
      <ul className="mt-2 space-y-1.5">
        {ex.reasons.map((r) => (
          <li key={r} className="flex gap-2 text-sm text-slate-700">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            {r}
          </li>
        ))}
      </ul>

      {ex.considerations.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold">Things to consider</h3>
          <ul className="mt-2 space-y-1.5">
            {ex.considerations.map((r) => (
              <li key={r} className="flex gap-2 text-sm text-slate-700">
                <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
                {r}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-5 text-[11px] text-muted-foreground">
        {source === "supabase"
          ? "Scores are calculated from OpenStreetMap data within about 1 km of the area’s centre."
          : "Demo uses simulated scores, not real city data."}
      </p>
    </div>
  );
}
