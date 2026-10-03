"use client";

import type { ReactNode } from "react";
import { Check, Info, MapPin, ShieldCheck, X } from "lucide-react";
import { explainMatch, type MatchLevel } from "@/lib/scoring/explain";
import { SAFETY_NOT_INCLUDED, describeAll, describeNightlife, describeSafetyParts } from "@/lib/scoring/facts";
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
  /** Safety indicators level 0–100; null = no data for this area. */
  safety?: number | null;
  /** Minimum safety level chosen by the user (0 = off). */
  minSafety?: number;
  district: string | null;
  indicators: HexIndicators | null;
  source: HexSource;
  weights: CategoryWeights;
  onClose: () => void;
  /** Pins legend + list of the real places behind the scores. */
  placesSlot?: ReactNode;
  /** Construction / renovation warnings near the area, each with its source. */
  worksSlot?: ReactNode;
};

export function AreaPanel({ scores, safety = null, minSafety = 0, district, indicators, source, weights, onClose, placesSlot, worksSlot }: Props) {
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

      {worksSlot}

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

      {(safety !== null || minSafety > 0) && (
        <SafetySection safety={safety} minSafety={minSafety} indicators={indicators} />
      )}

      {placesSlot}

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

function SafetySection({
  safety,
  minSafety,
  indicators,
}: {
  safety: number | null;
  minSafety: number;
  indicators: HexIndicators | null;
}) {
  const parts = indicators ? describeSafetyParts(indicators) : [];
  const nightlife = indicators ? describeNightlife(indicators) : null;
  const below = safety !== null && minSafety > 0 && safety < minSafety;
  return (
    <div className="mt-6 rounded-2xl border border-border/70 p-3.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="size-4 text-slate-700" />
          Safety indicators
        </span>
        <span className="font-semibold tabular-nums">{safety === null ? "no data" : `${safety}/100`}</span>
      </div>
      {safety !== null && (
        <div className="mt-1.5 h-1.5 rounded-full bg-muted">
          <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${safety}%` }} />
        </div>
      )}
      {below && (
        <p className="mt-2 flex gap-2 text-xs text-amber-700">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Below your minimum safety level, so it is greyed out on the map.
        </p>
      )}
      {safety === null && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Too few mapped streets nearby to say anything. This area is not filtered out.
        </p>
      )}

      {parts.length > 0 && (
        <>
          <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
            Each indicator is compared with the other built-up areas of Kraków (0 = lowest, 100 = highest) and the
            results are combined by the shares below.
          </p>
          <ul className="mt-2 space-y-2.5">
            {parts.map((p) => (
              <li key={p.key} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    {p.label}
                    {p.sharePct !== null && (
                      <span className="ml-1.5 font-normal text-muted-foreground">counts {p.sharePct}%</span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums">{p.score ?? "–"}</span>
                </div>
                {p.score !== null && (
                  <div className="mt-1 h-1 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-slate-700" style={{ width: `${p.score}%` }} />
                  </div>
                )}
                <p className="mt-1 leading-snug text-muted-foreground">{p.fact}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {nightlife && (
        <div className="mt-3 rounded-xl bg-muted/60 px-2.5 py-2 text-xs">
          <div className="font-medium text-slate-800">After dark (context, not scored)</div>
          <p className="mt-0.5 leading-snug text-muted-foreground">
            {nightlife}. Nightlife can mean livelier streets late in the evening, and also more noise, so it is shown
            but kept out of the score.
          </p>
        </div>
      )}

      {parts.length > 0 && (
        <details className="group mt-3 text-xs">
          <summary className="cursor-pointer select-none font-medium text-slate-800 marker:text-slate-400">
            How is this measured?
          </summary>
          <ul className="mt-2 space-y-2 text-muted-foreground">
            {parts.map((p) => (
              <li key={p.key} className="leading-snug">
                <span className="font-medium text-slate-700">{p.label}.</span> {p.how}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">{SAFETY_NOT_INCLUDED}</p>
    </div>
  );
}
