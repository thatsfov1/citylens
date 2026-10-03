"use client";

import { useState } from "react";
import { Banknote, Car, GraduationCap, ShieldCheck, X } from "lucide-react";
import { FilterGroup } from "./filter-group";
import { RentFilter, isRentActive } from "./rent-filter";
import { MIN_SAFETY_LEVELS } from "@/lib/scoring/preferences";
import { ROOMS_OPTIONS, formatRentRange, type RentFilter as RentBudget } from "@/lib/scoring/rent";
import { EDUCATION_STAGES, EDUCATION_STAGE_LABELS, type EducationStage } from "@/types";

/** Education life stages that count toward the education score. `showTitle` is off inside the Filters window, where the group header names it. */
export function StageFilter({ value, onToggle, showTitle = true }: { value: EducationStage[]; onToggle: (s: EducationStage) => void; showTitle?: boolean }) {
  return (
    <div className={showTitle ? "mt-4" : ""}>
      {showTitle && (
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <GraduationCap className="size-3.5" />
          Education: which stages matter?
        </div>
      )}
      <div className={`${showTitle ? "mt-2 " : ""}flex flex-wrap gap-1.5`}>
        {EDUCATION_STAGES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={value.includes(s)}
            onClick={() => onToggle(s)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              value.includes(s) ? "border-slate-800 bg-slate-800 text-white" : "border-border bg-white hover:bg-muted"
            }`}
          >
            {EDUCATION_STAGE_LABELS[s]}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        The education score counts only the stages you select. It reflects access to nearby places, not school quality.
      </p>
    </div>
  );
}

function SafetyFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div role="radiogroup" aria-label="Minimum safety level" className="flex gap-1 rounded-full bg-muted p-1">
        {MIN_SAFETY_LEVELS.map((l) => (
          <button
            key={l.value}
            role="radio"
            aria-checked={value === l.value}
            onClick={() => onChange(l.value)}
            className={`flex-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
              value === l.value ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {value > 0
          ? "Areas below this level are greyed out and left out of “Strongest areas”. Areas without data stay visible."
          : "Optional: grey out areas with fewer safety indicators in their favour."}
      </p>
    </div>
  );
}

type Props = {
  onClose: () => void;
  onResetAll: () => void;
  hasRent: boolean;
  rent: RentBudget;
  onRent: (v: RentBudget) => void;
  car: boolean;
  onCar: (v: boolean) => void;
  hasSafety: boolean;
  minSafety: number;
  onMinSafety: (v: number) => void;
  showStages: boolean;
  stages: EducationStage[];
  onToggleStage: (s: EducationStage) => void;
};

/** The Filters window: one collapsible group per filter, each with its current value in the header. */
export function FiltersWindow(p: Props) {
  const rentActive = p.hasRent && isRentActive(p.rent);
  const safetyActive = p.minSafety > 0;
  const stagesActive = p.stages.length < EDUCATION_STAGES.length;
  const anyActive = rentActive || safetyActive || p.car || (p.showStages && stagesActive);

  // Groups with a value set start open; when nothing is set the first group is open so the window never looks empty.
  const firstGroup = p.hasRent ? "rent" : "car";
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({
    rent: rentActive || (!anyActive && firstGroup === "rent"),
    car: p.car || (!anyActive && firstGroup === "car"),
    safety: safetyActive,
    stages: p.showStages && stagesActive,
  }));
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const rooms = ROOMS_OPTIONS.find((r) => r.value === p.rent.rooms)?.label;
  const safetyLabel = MIN_SAFETY_LEVELS.find((l) => l.value === p.minSafety)?.label ?? "Off";

  return (
    <section
      aria-label="Filters"
      className="absolute inset-x-3 top-28 z-10 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-border/70 bg-white/95 p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:left-4 sm:top-16 sm:max-h-[calc(100dvh-5.5rem)] sm:w-[22rem]"
    >
      <div className="flex items-center justify-between gap-2 pb-1">
        <h2 className="text-sm font-semibold">Filters</h2>
        <div className="flex items-center gap-1">
          {(rentActive || safetyActive || (p.showStages && stagesActive)) && (
            <button type="button" onClick={p.onResetAll} className="rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Reset all
            </button>
          )}
          <button onClick={p.onClose} aria-label="Close filters" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-border/70">
        {p.hasRent && (
          <FilterGroup
            title="Rent budget"
            icon={<Banknote className="size-4" />}
            summary={rentActive ? `${formatRentRange(p.rent)} · ${rooms}` : "Off"}
            active={rentActive}
            open={!!open.rent}
            onToggle={() => toggle("rent")}
          >
            <RentFilter value={p.rent} onChange={p.onRent} car={p.car} />
          </FilterGroup>
        )}

        <FilterGroup
          title="Car and parking"
          icon={<Car className="size-4" />}
          summary={p.car ? "On" : "Off"}
          active={p.car}
          open={!!open.car}
          onToggle={() => toggle("car")}
        >
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-muted/60 p-2.5">
            <input type="checkbox" checked={p.car} onChange={(e) => p.onCar(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-emerald-600" />
            <span className="text-xs leading-snug">
              <span className="font-medium text-slate-900">I have a car (show parking info)</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Adds car parks, parking meters and park and ride around the open area. Information only, it does not change the scores or the map colours.
              </span>
            </span>
          </label>
        </FilterGroup>

        {p.hasSafety && (
          <FilterGroup
            title="Minimum safety level"
            icon={<ShieldCheck className="size-4" />}
            summary={safetyLabel}
            active={safetyActive}
            open={!!open.safety}
            onToggle={() => toggle("safety")}
          >
            <SafetyFilter value={p.minSafety} onChange={p.onMinSafety} />
          </FilterGroup>
        )}

        {p.showStages && (
          <FilterGroup
            title="Education stages"
            icon={<GraduationCap className="size-4" />}
            summary={stagesActive ? `${p.stages.length} of ${EDUCATION_STAGES.length}` : "All stages"}
            active={stagesActive}
            open={!!open.stages}
            onToggle={() => toggle("stages")}
          >
            <StageFilter value={p.stages} onToggle={p.onToggleStage} showTitle={false} />
          </FilterGroup>
        )}
      </div>
    </section>
  );
}
