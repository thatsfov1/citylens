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
          Edukacja: które etapy mają znaczenie?
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
        Wynik edukacji uwzględnia tylko wybrane etapy. Odzwierciedla dostęp do pobliskich miejsc, a nie jakość szkół.
      </p>
    </div>
  );
}

function SafetyFilter({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div role="radiogroup" aria-label="Minimalny poziom bezpieczeństwa" className="flex gap-1 rounded-full bg-muted p-1">
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
          ? "Obszary poniżej tego poziomu są wyszarzone i pomijane przy wskazaniu pierwszego dopasowania. Obszary bez danych pozostają widoczne."
          : "Opcjonalnie: wyszarz obszary z mniejszą liczbą wskaźników bezpieczeństwa na ich korzyść."}
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
  const safetyLabel = MIN_SAFETY_LEVELS.find((l) => l.value === p.minSafety)?.label ?? "Wył.";

  return (
    <section
      aria-label="Filtry"
      className="absolute inset-x-3 top-[4.5rem] z-10 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-border/70 bg-white/95 p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:left-4 sm:top-16 sm:max-h-[calc(100dvh-5.5rem)] sm:w-[22rem]"
    >
      <div className="flex items-center justify-between gap-2 pb-1">
        <h2 className="text-sm font-semibold">Filtry</h2>
        <div className="flex items-center gap-1">
          {(rentActive || safetyActive || (p.showStages && stagesActive)) && (
            <button type="button" onClick={p.onResetAll} className="rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">
              Resetuj wszystko
            </button>
          )}
          <button onClick={p.onClose} aria-label="Zamknij filtry" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-border/70">
        {p.hasRent && (
          <FilterGroup
            title="Budżet na wynajem"
            icon={<Banknote className="size-4" />}
            summary={rentActive ? `${formatRentRange(p.rent)} · ${rooms}` : "Wył."}
            active={rentActive}
            open={!!open.rent}
            onToggle={() => toggle("rent")}
          >
            <RentFilter value={p.rent} onChange={p.onRent} car={p.car} />
          </FilterGroup>
        )}

        <FilterGroup
          title="Samochód i parking"
          icon={<Car className="size-4" />}
          summary={p.car ? "Wł." : "Wył."}
          active={p.car}
          open={!!open.car}
          onToggle={() => toggle("car")}
        >
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-muted/60 p-2.5">
            <input type="checkbox" checked={p.car} onChange={(e) => p.onCar(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-emerald-600" />
            <span className="text-xs leading-snug">
              <span className="font-medium text-slate-900">Mam samochód (pokaż informacje o parkowaniu)</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Dodaje parkingi, parkometry i parkingi P+R wokół otwartego obszaru. To tylko informacja, nie zmienia wyników ani kolorów mapy.
              </span>
            </span>
          </label>
        </FilterGroup>

        {p.hasSafety && (
          <FilterGroup
            title="Minimalny poziom bezpieczeństwa"
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
            title="Etapy edukacji"
            icon={<GraduationCap className="size-4" />}
            summary={stagesActive ? `${p.stages.length} z ${EDUCATION_STAGES.length}` : "Wszystkie etapy"}
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
