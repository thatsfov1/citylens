"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Hexagon, ShieldCheck } from "lucide-react";
import { AreaPanel } from "./area-panel";
import { HexMap, LEGEND_GRADIENT } from "./hex-map";
import { OsmAttribution } from "@/components/osm-attribution";
import { ModeSelector } from "./mode-selector";
import { PlacesList } from "./places-list";
import { WorksWarnings } from "./works-warnings";
import { EDUCATION_KIND_STAGES } from "@/lib/data/osm";
import { defaultPinCategories } from "@/lib/map/places";
import { NO_DATA_COLOR } from "@/lib/map/zones";
import { MIN_SAFETY_LEVELS, importanceToQuery, type Importance } from "@/lib/scoring/preferences";
import { stagesToParam, withEducationStages } from "@/lib/scoring/education";
import { normalizeWeights } from "@/lib/scoring/weights";
import type { HexSource, HexDetails } from "@/lib/supabase/hex-scores";
import {
  EDUCATION_STAGES,
  EDUCATION_STAGE_LABELS,
  type Category,
  type EducationStage,
  type HexData,
  type MapMode,
  type PlacesResponse,
  type WorkNearby,
} from "@/types";

export function MapExperience({
  hexes,
  source,
  importance,
  initialMinSafety = 0,
  initialStages = [...EDUCATION_STAGES],
}: {
  hexes: HexData[];
  source: HexSource;
  importance: Importance;
  /** Minimum safety level from the URL (0 = off). */
  initialMinSafety?: number;
  /** Education life stages from the URL (`?edu=`); all stages by default. */
  initialStages?: EducationStage[];
}) {
  const [mode, setMode] = useState<MapMode>("forYou");
  // Safety is optional data: the view and the filter only appear when cells carry safety indicators.
  const hasSafety = useMemo(() => hexes.some((h) => h.safety != null), [hexes]);
  const [minSafety, setMinSafety] = useState(hasSafety ? initialMinSafety : 0);
  const changeMinSafety = (v: number) => {
    setMinSafety(v);
    // Keep the level in the URL (shareable) without a navigation.
    const url = new URL(window.location.href);
    if (v > 0) url.searchParams.set("minSafety", String(v));
    else url.searchParams.delete("minSafety");
    window.history.replaceState(null, "", url);
  };
  // Education has four life stages; the score shown is the mean of the selected ones (recomputed client-side).
  const hasStages = useMemo(() => hexes.some((h) => h.educationStages), [hexes]);
  const [stages, setStages] = useState<EducationStage[]>(initialStages);
  const toggleStage = (s: EducationStage) => {
    const next = stages.includes(s) ? stages.filter((x) => x !== s) : [...stages, s];
    if (next.length === 0) return; // at least one stage must stay selected
    setStages(next);
    const url = new URL(window.location.href);
    const param = stagesToParam(next);
    if (param) url.searchParams.set("edu", param);
    else url.searchParams.delete("edu");
    window.history.replaceState(null, "", url);
  };
  const viewHexes = useMemo(() => withEducationStages(hexes, stages), [hexes, stages]);
  const showStageFilter = hasStages && (mode === "education" || (mode === "forYou" && importance.education > 0));
  const [selected, setSelected] = useState<string | null>(null);
  const weights = useMemo(() => normalizeWeights(importance), [importance]);
  const hex = useMemo(
    () => (selected ? (viewHexes.find((h) => h.h3Index === selected) ?? null) : null),
    [viewHexes, selected],
  );

  // OSM-derived facts for the selected hexagon, fetched on demand (kept out of the initial payload).
  const [details, setDetails] = useState<HexDetails | null>(null);
  useEffect(() => {
    if (!selected || source !== "supabase") return;
    const ctrl = new AbortController();
    fetch(`/api/hexes/${selected}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<HexDetails>) : null))
      .then((d) => setDetails(d))
      .catch(() => {});
    return () => {
      ctrl.abort();
      setDetails(null);
    };
  }, [selected, source]);

  // Places (pins) behind the selected hexagon. Failure just means the text-only panel.
  const [places, setPlaces] = useState<PlacesResponse | null>(null);
  useEffect(() => {
    if (!selected || source !== "supabase") return;
    const ctrl = new AbortController();
    fetch(`/api/hexes/${selected}/places`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<PlacesResponse>) : null))
      .then((d) => setPlaces(d))
      .catch(() => {});
    return () => {
      ctrl.abort();
      setPlaces(null);
    };
  }, [selected, source]);

  // Construction / renovation works near the selected hexagon. Failure just means no warning block.
  const [works, setWorks] = useState<WorkNearby[]>([]);
  useEffect(() => {
    if (!selected || source !== "supabase") return;
    const ctrl = new AbortController();
    fetch(`/api/hexes/${selected}/works`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ works: WorkNearby[] }>) : null))
      .then((d) => setWorks(d?.works ?? []))
      .catch(() => {});
    return () => {
      ctrl.abort();
      setWorks([]);
    };
  }, [selected, source]);

  // Which categories are pinned: the active mode (or top preferences), adjustable with chips.
  // Overrides are tied to the (mode, hexagon) they were made in, so they reset on change.
  const pinKey = `${mode}|${selected}`;
  const [pinOverride, setPinOverride] = useState<{ key: string; cats: Set<Category> } | null>(null);
  const pinCategories = useMemo(
    () => (pinOverride?.key === pinKey ? pinOverride.cats : defaultPinCategories(mode === "safety" ? "forYou" : mode, weights)),
    [pinOverride, pinKey, mode, weights],
  );
  const togglePin = (c: Category) => {
    const next = new Set(pinCategories);
    if (!next.delete(c)) next.add(c);
    setPinOverride({ key: pinKey, cats: next });
  };
  // Education pins follow the selected life stages; a school of unknown level counts for both school stages.
  const placesView = useMemo(
    () =>
      places && {
        ...places,
        places: places.places.filter(
          (p) => p.category !== "education" || (EDUCATION_KIND_STAGES[p.kind] ?? []).some((s) => stages.includes(s)),
        ),
      },
    [places, stages],
  );
  const [hoveredPlace, setHoveredPlace] = useState<number | null>(null);
  const [focusPlace, setFocusPlace] = useState<{ id: number; n: number } | null>(null);

  return (
    <div className="relative flex-1 overflow-hidden">
      <HexMap
        hexes={viewHexes}
        weights={weights}
        mode={mode}
        selected={selected}
        onSelect={setSelected}
        places={placesView}
        pinCategories={pinCategories}
        hoveredPlace={hoveredPlace}
        onHoverPlace={setHoveredPlace}
        focusPlace={focusPlace}
        minSafety={minSafety}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-3 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
        <Link
          href={`/?${importanceToQuery(importance)}`}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/70 bg-white/90 py-1.5 pl-2.5 pr-4 text-sm font-medium shadow-lg shadow-black/5 backdrop-blur hover:bg-white"
        >
          <ArrowLeft className="size-4" />
          <Hexagon className="size-4 text-emerald-600" />
          Adjust preferences
        </Link>
        <div className="pointer-events-auto max-w-full sm:absolute sm:left-1/2 sm:-translate-x-1/2">
          <ModeSelector mode={mode} onChange={setMode} hasSafety={hasSafety} />
        </div>
      </div>

      <aside className="absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto rounded-t-3xl border border-border/70 bg-white/95 shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-16 sm:max-h-[calc(100%-5.5rem)] sm:w-[22rem] sm:rounded-3xl">
        {showStageFilter && <StageFilter value={stages} onToggle={toggleStage} />}
        {hasSafety && <SafetyFilter value={minSafety} onChange={changeMinSafety} />}
        <AreaPanel
          scores={hex?.scores ?? null}
          safety={hex?.safety ?? null}
          air={hex?.air ?? null}
          minSafety={minSafety}
          district={hex?.district ?? null}
          indicators={details?.indicators ?? null}
          source={source}
          weights={weights}
          stages={stages}
          onClose={() => setSelected(null)}
          worksSlot={<WorksWarnings works={works} />}
          placesSlot={
            placesView && (
              <PlacesList
                places={placesView}
                active={pinCategories}
                onToggle={togglePin}
                hovered={hoveredPlace}
                onHover={setHoveredPlace}
                onFocus={(id) => setFocusPlace((f) => ({ id, n: (f?.n ?? 0) + 1 }))}
              />
            )
          }
        />
      </aside>

      <Legend mode={mode} minSafety={minSafety} />
    </div>
  );
}

function StageFilter({ value, onToggle }: { value: EducationStage[]; onToggle: (s: EducationStage) => void }) {
  return (
    <div className="border-b border-border/70 px-5 py-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <GraduationCap className="size-3.5" />
        Education: which stages matter?
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
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
    <div className="border-b border-border/70 px-5 py-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        Minimum safety level
      </div>
      <div role="radiogroup" aria-label="Minimum safety level" className="mt-2 flex gap-1 rounded-full bg-muted p-1">
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

function Legend({ mode, minSafety }: { mode: MapMode; minSafety: number }) {
  return (
    <div className="pointer-events-none absolute left-3 top-28 rounded-xl border border-border/70 bg-white/90 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur sm:bottom-6 sm:left-4 sm:top-auto">
      <div className="mb-1.5 text-[11px] font-medium text-slate-600">
        {mode === "forYou" ? "Match for you" : mode === "safety" ? "Safety indicators" : "Category score"}
      </div>
      <div className="h-2 w-40 rounded-full" style={{ background: LEGEND_GRADIENT }} />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{mode === "forYou" ? "Weaker match" : mode === "safety" ? "Fewer in favour" : "Low"}</span>
        <span>{mode === "forYou" ? "Stronger match" : mode === "safety" ? "More in favour" : "High"}</span>
      </div>
      {mode !== "forYou" && (
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-2.5 rounded-sm" style={{ background: NO_DATA_COLOR }} />
          {mode === "safety" ? "No safety data" : "Nothing nearby (no data)"}
        </div>
      )}
      {mode !== "safety" && minSafety > 0 && (
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-2.5 rounded-sm bg-slate-600/60" />
          Below your minimum safety level
        </div>
      )}
      {mode === "safety" && (
        <div className="mt-1 max-w-52 text-[10px] leading-snug text-muted-foreground">
          Street lighting, cameras and police, fire and hospital access nearby (OpenStreetMap). Indicators, not a verdict on an area.
        </div>
      )}
      <div className="mt-1 text-[10px] text-muted-foreground">
        Five bands, relative to the rest of Kraków
      </div>
      <OsmAttribution className="pointer-events-auto mt-1" />
    </div>
  );
}
