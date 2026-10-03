"use client";

import { Check, Info, MapPin, Shuffle, X } from "lucide-react";
import type { Contributor } from "@/lib/scoring/first-match";
import { CATEGORY_LABELS } from "@/types";
import { formatDistance, kindLabel, placeTitle } from "@/lib/map/places";

type Props = {
  score: number;
  district: string | null;
  headline: string;
  reason: string;
  /** Only when the data supports one. */
  tradeoff: string | null;
  contributor: Contributor | null;
  position: number;
  total: number;
  onCompare: () => void;
  onDismiss: () => void;
};

/** Shown once after the map opens: a data-backed look at one strong match, with the option to see another. */
export function FirstMatchCard({ score, district, headline, reason, tradeoff, contributor, position, total, onCompare, onDismiss }: Props) {
  return (
    <section className="border-b border-border/70 bg-emerald-50/70 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Your first match</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-emerald-700">{score}%</span>
            <span className="text-sm font-medium">{district ?? "Selected area"}</span>
          </div>
          <div className="text-xs text-slate-700">{headline}</div>
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="rounded-full p-1.5 text-muted-foreground hover:bg-white/70">
          <X className="size-4" />
        </button>
      </div>

      <ul className="mt-3 space-y-1.5 text-sm text-slate-800">
        <li className="flex gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          {reason}
        </li>
        {tradeoff && (
          <li className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-500" />
            {tradeoff}
          </li>
        )}
        {contributor && (
          <li className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-slate-500" />
            {contributor.category === "greenery" ? (
              <span>
                {contributor.name ?? "A green area"} ({contributor.areaHa.toFixed(1)} ha) nearby counts towards{" "}
                {CATEGORY_LABELS.greenery.toLowerCase()}.
              </span>
            ) : (
              <span>
                {placeTitle(contributor.place)}
                {contributor.place.name && ` (${kindLabel(contributor.place.kind)})`}, {formatDistance(contributor.place.distanceM)} away,
                counts towards {CATEGORY_LABELS[contributor.category].toLowerCase()}.
              </span>
            )}
          </li>
        )}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={onCompare}
          className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
        >
          <Shuffle className="size-3.5" />
          Compare another area
        </button>
        <span className="text-[11px] text-muted-foreground">
          {position} of {total} strongest areas
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        One of the stronger matches for your stated priorities, not the best place in Kraków.
      </p>
    </section>
  );
}
