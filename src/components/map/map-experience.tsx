"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Hexagon, MapPin, Minus, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { AirSection, AreaPanel, SafetySection, type PanelView } from "./area-panel";
import { HexMap, LEGEND_GRADIENT } from "./hex-map";
import { CompareTray } from "./compare-tray";
import { FirstMatchCard } from "./first-match-card";
import { OsmAttribution } from "@/components/osm-attribution";
import { ModeSelector } from "./mode-selector";
import { CategoryPlaces } from "./places-list";
import { WorksWarnings } from "./works-warnings";
import { EDUCATION_KIND_STAGES } from "@/lib/data/osm";
import { explainMatch } from "@/lib/scoring/explain";
import { describeAll } from "@/lib/scoring/facts";
import { MAX_COMPARED, compareAreas } from "@/lib/scoring/compare";
import { strongestAreas, topContributor } from "@/lib/scoring/first-match";
import { groupWorks } from "@/lib/data/works";
import { fetchCached } from "@/lib/map/hex-cache";
import { defaultPinCategories } from "@/lib/map/places";
import { NO_DATA_COLOR } from "@/lib/map/zones";
import { computeSensitivity } from "@/lib/scoring/sensitivity";
import { MIN_SAFETY_LEVELS, avoidToQuery, importanceToQuery, type Importance } from "@/lib/scoring/preferences";
import { createScorer } from "@/lib/scoring/personal-score";
import { stagesToParam, withEducationStages } from "@/lib/scoring/education";
import { formatRadius, hexesOutsideAnchor, type Anchor } from "@/lib/scoring/anchor";
import { normalizeWeights } from "@/lib/scoring/weights";
import type { HexSource, HexDetails } from "@/lib/supabase/hex-scores";
import {
  CATEGORIES,
  CATEGORY_LABELS,
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
  anchor = null,
  initialAvoid,
}: {
  hexes: HexData[];
  source: HexSource;
  importance: Importance;
  /** Minimum safety level from the URL (0 = off). */
  initialMinSafety?: number;
  /** Education life stages from the URL (`?edu=`); all stages by default. */
  initialStages?: EducationStage[];
  /** A place the user wants to be near (`?near=`): hexes beyond its radius are dimmed. */
  anchor?: Anchor | null;
  /** Categories the user wants less of (`?avoid=`). */
  initialAvoid?: ReadonlySet<Category>;
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
  // Categories the user wants less of (quiet, few shops…): their score counts in reverse. Kept in the URL.
  const [avoid, setAvoid] = useState<ReadonlySet<Category>>(() => new Set(initialAvoid));
  const toggleAvoid = (c: Category) => {
    const next = new Set(avoid);
    if (!next.delete(c)) next.add(c);
    setAvoid(next);
    const url = new URL(window.location.href);
    const param = avoidToQuery(next);
    if (param) url.searchParams.set("avoid", param);
    else url.searchParams.delete("avoid");
    window.history.replaceState(null, "", url);
  };
  // Hexes beyond the anchor's radius; ignored when the place lies outside the city (nothing would be left).
  const outside = useMemo(() => {
    if (!anchor) return undefined;
    const out = hexesOutsideAnchor(hexes.map((h) => h.h3Index), anchor);
    return out.size < hexes.length ? out : undefined;
  }, [hexes, anchor]);
  const showStageFilter = hasStages && (mode === "education" || (mode === "forYou" && importance.education > 0));
  const [selected, setSelected] = useState<string | null>(null);
  const weights = useMemo(() => normalizeWeights(importance), [importance]);
  // Match relative to the city, so a centre that is strong on everything cannot win every preference by default.
  const score = useMemo(() => createScorer(viewHexes, weights, avoid), [viewHexes, weights, avoid]);
  const sensitivity = useMemo(
    () => (selected ? computeSensitivity(viewHexes, selected, importance, avoid) : null),
    [viewHexes, selected, importance, avoid],
  );
  // Areas the user is considering (up to three), compared side by side.
  const [compared, setCompared] = useState<string[]>([]);
  const toggleCompared = () => {
    if (!selected) return;
    setCompared((c) => (c.includes(selected) ? c.filter((x) => x !== selected) : c.length < MAX_COMPARED ? [...c, selected] : c));
  };
  const comparison = useMemo(() => compareAreas(viewHexes, compared, weights, score), [viewHexes, compared, weights, score]);
  const hex = useMemo(
    () => (selected ? (viewHexes.find((h) => h.h3Index === selected) ?? null) : null),
    [viewHexes, selected],
  );

  // OSM-derived facts for the selected hexagon, fetched on demand (kept out of the initial payload).
  const [details, setDetails] = useState<HexDetails | null>(null);
  useEffect(() => {
    if (!selected || source !== "supabase") return;
    const ctrl = new AbortController();
    fetchCached<HexDetails>(`/api/hexes/${selected}`, ctrl.signal)
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
    fetchCached<PlacesResponse>(`/api/hexes/${selected}/places`, ctrl.signal)
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
    fetchCached<{ works: WorkNearby[] }>(`/api/hexes/${selected}/works`, ctrl.signal)
      .then((d) => setWorks(d?.works ?? []))
      .catch(() => {});
    return () => {
      ctrl.abort();
      setWorks([]);
    };
  }, [selected, source]);

  // Detail view of the panel, tied to the hexagon it was opened in so it resets when another one is picked.
  const [detail, setDetail] = useState<{ hex: string | null; view: PanelView | null }>({ hex: null, view: null });
  const view = detail.hex === selected ? detail.view : null;
  const setView = (v: PanelView | null) => setDetail({ hex: selected, view: v });
  // Pins: the active mode (or top preferences), adjustable per category. Overrides are tied to the
  // mode they were made in (they reset when it changes) and persist across hexagons. An open category detail always adds its pins.
  const pinKey = mode;
  const [pinOverride, setPinOverride] = useState<{ key: string; cats: Set<Category> } | null>(null);
  const basePins = useMemo(
    () => (pinOverride?.key === pinKey ? pinOverride.cats : defaultPinCategories(mode === "safety" ? "forYou" : mode, weights)),
    [pinOverride, pinKey, mode, weights],
  );
  const pinCategories = useMemo(() => {
    if (!view || view === "safety" || view === "air" || view === "works") return basePins;
    return new Set<Category>([...basePins, view]);
  }, [basePins, view]);
  const togglePin = (c: Category) => {
    const next = new Set(pinCategories);
    if (!next.delete(c)) next.add(c);
    setPinOverride({ key: pinKey, cats: next });
  };
  const worksCount = useMemo(() => {
    const g = groupWorks(works, new Date());
    return g.ongoing.length + g.planned.length;
  }, [works]);
  // Education pins follow the selected life stages; a school of unknown level counts for both school stages.
  const forStages = useMemo(
    () => (r: PlacesResponse): PlacesResponse => ({
      ...r,
      places: r.places.filter(
        (p) => p.category !== "education" || (EDUCATION_KIND_STAGES[p.kind] ?? []).some((s) => stages.includes(s)),
      ),
    }),
    [stages],
  );
  const placesView = useMemo(() => places && forStages(places), [places, forStages]);
  // Compared areas keep their places on the map: fetched per area (cached), merged with the selected area's.
  const [comparedPlaces, setComparedPlaces] = useState<Record<string, PlacesResponse>>({});
  useEffect(() => {
    if (source !== "supabase") return;
    const ctrl = new AbortController();
    for (const id of compared) {
      fetchCached<PlacesResponse>(`/api/hexes/${id}/places`, ctrl.signal)
        .then((d) => d && setComparedPlaces((m) => (m[id] ? m : { ...m, [id]: d })))
        .catch(() => {});
    }
    return () => ctrl.abort();
  }, [compared, source]);
  const mapPlaces = useMemo(() => {
    const extra = compared.map((id) => comparedPlaces[id]).filter((r): r is PlacesResponse => !!r).map(forStages);
    if (extra.length === 0) return placesView;
    const all = [...(placesView ? [placesView] : []), ...extra];
    const seen = new Set<number>();
    const seenGreen = new Set<string>();
    return {
      places: all.flatMap((r) => r.places).filter((p) => !seen.has(p.id) && seen.add(p.id)),
      green: {
        type: "FeatureCollection" as const,
        features: all
          .flatMap((r) => r.green.features)
          .filter((f) => {
            const key = `${f.properties?.name ?? ""}|${f.properties?.areaHa ?? ""}`;
            return !seenGreen.has(key) && seenGreen.add(key);
          }),
      },
    } satisfies PlacesResponse;
  }, [placesView, compared, comparedPlaces, forStages]);
  // "Your first match": once, on load with real data, fly to one of the strongest areas and explain it.
  // The ranking is fixed at that moment so "Compare another area" walks a stable list.
  const [first, setFirst] = useState<{ ids: string[]; i: number } | null>(null);
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || source !== "supabase") return;
    autoPicked.current = true;
    const ids = strongestAreas(outside ? viewHexes.filter((h) => !outside.has(h.h3Index)) : viewHexes, weights, minSafety, score);
    if (ids.length === 0) return;
    // One-shot after mount on purpose: selecting here goes through the same fly-in as a click on the map.
    /* eslint-disable react-hooks/set-state-in-effect */
    setFirst({ ids, i: 0 });
    setSelected(ids[0]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [source, viewHexes, weights, minSafety, outside, score]);
  const compareAnother = () => {
    if (!first) return;
    const i = (first.i + 1) % first.ids.length;
    setFirst({ ...first, i });
    setSelected(first.ids[i]);
  };
  // Only while its area is the selected one and the data-backed facts have loaded (no generic text).
  const firstMatch = useMemo(() => {
    if (!first || !hex || view || selected !== first.ids[first.i] || !details?.indicators) return null;
    const ex = explainMatch(hex.scores, weights, describeAll(details.indicators, stages), { score, avoid });
    return { ex, contributor: placesView ? topContributor(placesView, weights, avoid) : null };
  }, [first, hex, view, selected, details, weights, stages, placesView, score, avoid]);

  // Info window opened from a safety / air badge on the hexagon; tied to the hexagon like the panel detail.
  const [badgeInfo, setBadgeInfo] = useState<{ hex: string | null; kind: "safety" | "air" | "works" | null }>({ hex: null, kind: null });
  const openBadge = badgeInfo.hex === selected ? badgeInfo.kind : null;

  // Filters (safety level, education stages) live in their own window so the side panel stays a summary.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFilters = true; // "prefer less of" is always available
  const activeFilters = avoid.size + (minSafety > 0 ? 1 : 0) + (hasStages && stages.length < EDUCATION_STAGES.length ? 1 : 0);

  const [hoveredPlace, setHoveredPlace] = useState<number | null>(null);
  const [focusPlace, setFocusPlace] = useState<{ id: number; n: number } | null>(null);

  return (
    <div className="relative flex-1 overflow-hidden">
      <HexMap
        hexes={viewHexes}
        score={score}
        mode={mode}
        selected={selected}
        onSelect={setSelected}
        places={mapPlaces}
        pinCategories={pinCategories}
        hoveredPlace={hoveredPlace}
        onHoverPlace={setHoveredPlace}
        focusPlace={focusPlace}
        minSafety={minSafety}
        outside={outside}
        compared={compared}
        badges={
          hex
            ? {
                safety: hex.safety ?? null,
                air: hex.air ?? null,
                works: worksCount,
                compare: { added: compared.includes(hex.h3Index), full: compared.length >= MAX_COMPARED },
              }
            : undefined
        }
        onBadge={(kind) => (kind === "compare" ? toggleCompared() : setBadgeInfo({ hex: selected, kind }))}
      />

      {filtersOpen && hasFilters && (
        <section className="absolute inset-x-3 top-28 z-10 space-y-4 rounded-2xl border border-border/70 bg-white/95 p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:left-4 sm:top-16 sm:w-[22rem]">
          <button
            onClick={() => setFiltersOpen(false)}
            aria-label="Close filters"
            className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
          <AvoidFilter importance={importance} value={avoid} onToggle={toggleAvoid} />
          {hasSafety && <SafetyFilter value={minSafety} onChange={changeMinSafety} inline />}
          {showStageFilter && <StageFilter value={stages} onToggle={toggleStage} inline />}
        </section>
      )}

      {openBadge && hex && (
        <section className="absolute inset-x-3 top-28 z-10 max-h-[40%] overflow-y-auto rounded-2xl border border-border/70 bg-white/95 px-4 pb-4 pt-3 shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-6 sm:right-[24rem] sm:top-auto sm:max-h-[60%] sm:w-[24rem]">
          <button
            onClick={() => setBadgeInfo({ hex: null, kind: null })}
            aria-label="Close"
            className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
          {openBadge === "safety" ? (
            <SafetySection safety={hex.safety ?? null} minSafety={minSafety} indicators={details?.indicators ?? null} />
          ) : openBadge === "works" ? (
            <WorksWarnings works={works} />
          ) : (
            hex.air != null && <AirSection air={hex.air} indicators={details?.indicators ?? null} />
          )}
        </section>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-3 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
        <Link
          href={`/?${importanceToQuery(importance)}`}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/70 bg-white/90 py-1.5 pl-2.5 pr-4 text-sm font-medium shadow-lg shadow-black/5 backdrop-blur hover:bg-white"
        >
          <ArrowLeft className="size-4" />
          <Hexagon className="size-4 text-emerald-600" />
          Adjust preferences
        </Link>
        {hasFilters && (
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={`flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-4 text-sm font-medium shadow-lg shadow-black/5 backdrop-blur ${
              filtersOpen ? "border-slate-800 bg-slate-800 text-white" : "border-border/70 bg-white/90 hover:bg-white"
            }`}
          >
            <SlidersHorizontal className="size-4" />
            Filters{activeFilters > 0 ? ` · ${activeFilters}` : ""}
          </button>
        )}
        {anchor && outside && (
          <span className="flex items-center gap-1.5 rounded-full border border-border/70 bg-white/90 py-1.5 pl-3 pr-4 text-sm font-medium shadow-lg shadow-black/5 backdrop-blur">
            <MapPin className="size-4 text-rose-600" />
            Near {anchor.name.split(",")[0]} · {formatRadius(anchor.radiusM)}
          </span>
        )}
        </div>
        <div className="pointer-events-auto max-w-full sm:absolute sm:left-1/2 sm:-translate-x-1/2">
          <ModeSelector mode={mode} onChange={setMode} hasSafety={hasSafety} />
        </div>
      </div>

      <aside className="absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto rounded-t-3xl border border-border/70 bg-white/95 shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-16 sm:max-h-[calc(100%-5.5rem)] sm:w-[22rem] sm:rounded-3xl">
        {firstMatch && first && hex && (
          <FirstMatchCard
            score={firstMatch.ex.score}
            district={hex.district ?? null}
            headline={firstMatch.ex.headline}
            reason={firstMatch.ex.reasons[0]}
            tradeoff={firstMatch.ex.considerations[0] ?? null}
            contributor={firstMatch.contributor}
            position={first.i + 1}
            total={first.ids.length}
            onCompare={compareAnother}
            onDismiss={() => setFirst(null)}
          />
        )}
        <AreaPanel
          scores={hex?.scores ?? null}
          safety={hex?.safety ?? null}
          air={hex?.air ?? null}
          minSafety={minSafety}
          district={hex?.district ?? null}
          indicators={details?.indicators ?? null}
          source={source}
          weights={weights}
          scoring={{ score, avoid }}
          sensitivity={sensitivity}
          stages={stages}
          onClose={() => setSelected(null)}
          view={view}
          onView={setView}
          pins={pinCategories}
          onTogglePin={togglePin}
          worksSlot={<WorksWarnings works={works} />}
          controlsFor={(c) => (c === "education" && hasStages ? <StageFilter value={stages} onToggle={toggleStage} inline /> : null)}
          placesFor={(c) =>
            placesView && (
              <CategoryPlaces
                category={c}
                places={placesView}
                hovered={hoveredPlace}
                onHover={setHoveredPlace}
                onFocus={(id) => setFocusPlace((f) => ({ id, n: (f?.n ?? 0) + 1 }))}
              />
            )
          }
        />
      </aside>

      <CompareTray
        comparison={comparison}
        selected={selected}
        onSelect={setSelected}
        onRemove={(id) => setCompared((c) => c.filter((x) => x !== id))}
        onClear={() => setCompared([])}
      />

      <Legend mode={mode} minSafety={minSafety} />
    </div>
  );
}

function AvoidFilter({ importance, value, onToggle }: { importance: Importance; value: ReadonlySet<Category>; onToggle: (c: Category) => void }) {
  const cats = CATEGORIES.filter((c) => importance[c] > 0);
  if (cats.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Minus className="size-3.5" />
        Prefer less of
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={value.has(c)}
            onClick={() => onToggle(c)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              value.has(c) ? "border-slate-800 bg-slate-800 text-white" : "border-border bg-white hover:bg-muted"
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        Areas with less of the selected categories match better, for example quieter areas with fewer shops.
      </p>
    </div>
  );
}

function StageFilter({ value, onToggle, inline = false }: { value: EducationStage[]; onToggle: (s: EducationStage) => void; inline?: boolean }) {
  return (
    <div className={inline ? "mt-4" : "border-b border-border/70 px-5 py-3"}>
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

function SafetyFilter({ value, onChange, inline = false }: { value: number; onChange: (v: number) => void; inline?: boolean }) {
  return (
    <div className={inline ? "" : "border-b border-border/70 px-5 py-3"}>
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
