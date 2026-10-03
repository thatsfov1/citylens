"use client";

import { RentSection } from "./rent-filter";
import { MODE_LABELS, formatMinutes, type TravelMode } from "@/lib/scoring/commute";
import type { RentFilter, RentSummary } from "@/lib/scoring/rent";
import type { ReactNode } from "react";
import { plPlural } from "@/lib/format/pl";
import { ArrowLeft, Briefcase, Bus, Check, ChevronRight, Footprints, Info, MapPin, ShieldCheck, TramFront, Wind, X } from "lucide-react";
import type { TransitPlan } from "@/lib/data/transit";
import { GREEN_COLOR, PLACE_COLORS } from "@/lib/map/places";
import { explainMatch, type MatchLevel } from "@/lib/scoring/explain";
import { AIR_CAVEAT, EDUCATION_CAVEAT, SAFETY_NOT_INCLUDED, describeAir, describeAirLevel, describeAll, describeNightlife, describeSafetyParts } from "@/lib/scoring/facts";
import type { Sensitivity } from "@/lib/scoring/sensitivity";
import type { HexSource } from "@/lib/supabase/hex-scores";
import { SensitivitySection } from "./sensitivity-section";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type CategoryScores,
  type CategoryWeights,
  type EducationStage,
  type HexIndicators,
} from "@/types";
import { cn } from "@/lib/utils";

const PIN_COLORS: Record<Category, string> = { ...PLACE_COLORS, greenery: GREEN_COLOR };

const LEVEL_STYLE: Record<MatchLevel, string> = {
  strong: "text-emerald-700",
  moderate: "text-amber-600",
  weak: "text-orange-600",
};

/** What the panel shows: the overview (null) or the detail of one category / safety / air / works. */
export type PanelView = Category | "safety" | "air" | "works";

type Props = {
  scores: CategoryScores | null;
  /** Safety indicators level 0–100; null = no data for this area. */
  safety?: number | null;
  /** Air quality 0–100 (higher = cleaner); null = no station in reach for this area. */
  air?: number | null;
  /** Minimum safety level chosen by the user (0 = off). */
  minSafety?: number;
  district: string | null;
  indicators: HexIndicators | null;
  source: HexSource;
  weights: CategoryWeights;
  /** Education life stages the user selected; the education fact lists only these. */
  stages?: readonly EducationStage[];
  onClose: () => void;
  /** Current detail view; null = overview. */
  view: PanelView | null;
  onView: (v: PanelView | null) => void;
  /** Categories whose pins are shown on the map, and the toggle for one of them. */
  pins?: ReadonlySet<Category>;
  onTogglePin?: (c: Category) => void;
  /** Real places behind one category's score (pins on the map follow the open category). */
  placesFor?: (c: Category) => ReactNode;
  /** Extra controls shown in a category's detail (e.g. the education stage filter). */
  controlsFor?: (c: Category) => ReactNode;
  /** Full construction / renovation warnings, each with its source. */
  worksSlot?: ReactNode;
  /** Does the match survive nudging one priority? Null = not computed. */
  sensitivity?: Sensitivity | null;
  /** Typical rent of this area for the chosen flat size; set only while a rent budget is active. */
  rent?: (RentSummary & { filter: RentFilter }) | null;
  /** Commute from this area to the workplace; set only while a workplace is chosen. */
  commute?: { minutes: number; maxMin: number; mode: TravelMode; workName: string; approx: boolean; distanceKm?: number | null; transit?: TransitPlan | null } | null;
};

export function AreaPanel({ scores, safety = null, air = null, minSafety = 0, district, indicators, source, weights, stages, onClose, view, onView, pins, onTogglePin, placesFor, controlsFor, worksSlot, sensitivity, rent = null, commute = null }: Props) {
  const byWeight = [...CATEGORIES].sort((a, b) => weights[b] - weights[a]);
  // Bars are relative to the largest weight, so the top priority fills the bar.
  const maxWeight = Math.max(...CATEGORIES.map((c) => weights[c]), 0.0001);

  if (!scores) {
    return (
      <div className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="size-4 text-emerald-600" />
          Kliknij sześciokąt, aby zobaczyć, jak pasuje do Ciebie
        </div>
        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Zrozumieliśmy
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Udział Twoich priorytetów; paski są liczone względem największego.</p>
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
                  style={{ width: `${(weights[c] / maxWeight) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Barwione są tylko wyraźnie mocniejsze lub słabsze dopasowania; najedź na
          dowolny obszar, aby go poznać. Słabsze dopasowanie to nie gorsze miejsce, tylko inne dopasowanie.
        </p>
      </div>
    );
  }

  const facts = indicators ? describeAll(indicators, stages) : undefined;
  const ex = explainMatch(scores, weights, facts);

  if (view) {
    const back = (
      <button
        onClick={() => onView(null)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Przegląd
      </button>
    );
    return (
      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          {back}
          <button onClick={onClose} aria-label="Zamknij" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        {view === "safety" ? (
          <SafetySection safety={safety} minSafety={minSafety} indicators={indicators} />
        ) : view === "air" ? (
          air !== null && <AirSection air={air} indicators={indicators} />
        ) : view === "works" ? (
          worksSlot
        ) : (
          <CategoryDetail
            category={view}
            score={scores[view]}
            weight={weights[view]}
            fact={facts?.[view]}
            controls={controlsFor?.(view)}
            places={placesFor?.(view)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dopasowanie obszaru{district ? ` · ${district}` : ""}
          </div>
          <div className={cn("mt-1 text-5xl font-semibold tabular-nums", LEVEL_STYLE[ex.level])}>
            {ex.score}%
          </div>
          <div className="mt-1 text-sm font-medium">{ex.headline}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Zamknij"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="mt-5 text-[11px] text-muted-foreground">Kropki włączają pinezki na mapie; stuknij wiersz, aby zobaczyć szczegóły.</p>
      <ul className="mt-1.5 space-y-1">
        {byWeight.map((c) => (
          <li key={c} className="flex items-center gap-1">
            {pins && onTogglePin && (
              <button
                type="button"
                aria-pressed={pins.has(c)}
                aria-label={`${pins.has(c) ? "Ukryj" : "Pokaż"} pinezki kategorii ${CATEGORY_LABELS[c]} na mapie`}
                title={pins.has(c) ? "Ukryj pinezki na mapie" : "Pokaż pinezki na mapie"}
                onClick={() => onTogglePin(c)}
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                  pins.has(c) ? "border-slate-800 bg-slate-800" : "border-border bg-white hover:bg-muted",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ background: PIN_COLORS[c] }} />
              </button>
            )}
            <button
              onClick={() => onView(c)}
              className="group min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/70"
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  {CATEGORY_LABELS[c]}
                  <span className="ml-1.5 text-xs text-muted-foreground">waga {Math.round(weights[c] * 100)}%</span>
                </span>
                <span className="flex items-center gap-1 font-semibold tabular-nums">
                  {scores[c]}
                  <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
              <span className="mt-1 block h-1.5 rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-slate-800 transition-all"
                  style={{ width: `${scores[c]}%` }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {rent && <RentSection {...rent} district={district} />}

      {commute && (
        <div className="mt-4 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Briefcase className="size-3.5" />
            Dojazd do pracy
          </div>
          <p className="mt-1">
            <span className="font-semibold tabular-nums">
              {commute.approx ? "≈ " : "~"}
              {formatMinutes(commute.minutes)}
            </span>{" "}
            {MODE_LABELS[commute.mode]} do: {commute.workName}
            {commute.distanceKm ? ` · ${commute.distanceKm.toFixed(1)} km` : ""}
          </p>
          {commute.transit && <TransitSteps plan={commute.transit} />}
          <p className={commute.minutes > commute.maxMin ? "mt-0.5 text-xs text-orange-600" : "mt-0.5 text-xs text-emerald-700"}>
            {commute.minutes > commute.maxMin
              ? `${commute.minutes - commute.maxMin} min ponad Twój limit ${commute.maxMin} min`
              : `W ramach Twojego limitu ${commute.maxMin} min`}
            {commute.approx ? " · szacunek przybliżony" : ""}
          </p>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">Dlaczego pasuje do Ciebie</h3>
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
          <h3 className="mt-5 text-sm font-semibold">Warto wziąć pod uwagę</h3>
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
      {sensitivity && <SensitivitySection sensitivity={sensitivity} />}
      <p className="mt-5 text-[11px] text-muted-foreground">
        {source === "supabase"
          ? "Wyniki liczone są na podstawie danych OpenStreetMap w promieniu ok. 1 km od środka obszaru. Stuknij kategorię, aby zobaczyć szczegóły."
          : "Demo używa symulowanych wyników, a nie rzeczywistych danych miasta."}
      </p>
    </div>
  );
}

function CategoryDetail({
  category,
  score,
  weight,
  fact,
  controls,
  places,
}: {
  category: Category;
  score: number;
  weight: number;
  fact?: string;
  controls?: ReactNode;
  places?: ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {CATEGORY_LABELS[category]} · waga {Math.round(weight * 100)}%
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tabular-nums">{score}</span>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted">
        <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${score}%` }} />
      </div>
      {fact && <p className="mt-3 text-sm leading-snug text-slate-700">{fact}</p>}
      {controls}
      {places}
      {fact && category === "education" && (
        <p className="mt-4 text-[11px] leading-snug text-muted-foreground">{EDUCATION_CAVEAT}</p>
      )}
    </div>
  );
}

export function AirSection({ air, indicators }: { air: number; indicators: HexIndicators | null }) {
  const facts = indicators ? describeAir(indicators) : [];
  const level = indicators ? describeAirLevel(indicators) : null;
  return (
    <div className="mt-4 rounded-2xl border border-border/70 p-3.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <Wind className="size-4 text-slate-700" />
          Jakość powietrza
        </span>
        <span className="font-semibold tabular-nums">{air}/100</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted">
        <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${air}%` }} />
      </div>
      {level && <p className="mt-1.5 text-xs text-slate-700">{level}</p>}
      <details open className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
          Szczegóły
        </summary>
        {facts.length > 0 && (
          <ul className="mt-1.5 space-y-1 text-xs text-slate-700">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{AIR_CAVEAT}</p>
      </details>
    </div>
  );
}

export function SafetySection({
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
    <div className="mt-4 rounded-2xl border border-border/70 p-3.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="size-4 text-slate-700" />
          Wskaźniki bezpieczeństwa
        </span>
        <span className="font-semibold tabular-nums">{safety === null ? "brak danych" : `${safety}/100`}</span>
      </div>
      {safety !== null && (
        <div className="mt-1.5 h-1.5 rounded-full bg-muted">
          <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${safety}%` }} />
        </div>
      )}
      {below && (
        <p className="mt-2 flex gap-2 text-xs text-amber-700">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Poniżej Twojego minimalnego poziomu bezpieczeństwa, więc jest wyszarzony na mapie.
        </p>
      )}
      {safety === null && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Zbyt mało zmapowanych ulic w pobliżu, by cokolwiek powiedzieć. Ten obszar nie jest odfiltrowywany.
        </p>
      )}

      <details open className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
          Szczegóły
        </summary>
      {parts.length > 0 && (
        <>
          <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
            Każdy wskaźnik jest porównywany z innymi zabudowanymi obszarami Krakowa (0 = najniższy, 100 = najwyższy),
            a wyniki łączone według poniższych udziałów.
          </p>
          <ul className="mt-2 space-y-2.5">
            {parts.map((p) => (
              <li key={p.key} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    {p.label}
                    {p.sharePct !== null && (
                      <span className="ml-1.5 font-normal text-muted-foreground">liczy się w {p.sharePct}%</span>
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
          <div className="font-medium text-slate-800">Po zmroku (kontekst, bez wpływu na wynik)</div>
          <p className="mt-0.5 leading-snug text-muted-foreground">
            {nightlife}. Życie nocne może oznaczać żywsze ulice późnym wieczorem, ale też więcej hałasu, dlatego jest
            pokazane, lecz nie wchodzi do wyniku.
          </p>
        </div>
      )}

      {parts.length > 0 && (
        <details className="group mt-3 text-xs">
          <summary className="cursor-pointer select-none font-medium text-slate-800 marker:text-slate-400">
            Jak to jest mierzone?
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
      </details>
    </div>
  );
}

/** Step-by-step bus/tram itinerary from the official ZTP Kraków timetable. */
function TransitSteps({ plan }: { plan: TransitPlan }) {
  return (
    <div className="mt-2">
      <ol className="space-y-1.5">
        {plan.legs.map((leg, i) =>
          leg.type === "walk" ? (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Footprints className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Pieszo {leg.minutes} min ({leg.meters} m) do: {leg.to}
              </span>
            </li>
          ) : (
            <li key={i} className="flex items-start gap-2 text-xs">
              {leg.mode === "tram" ? <TramFront className="mt-0.5 size-3.5 shrink-0 text-sky-700" /> : <Bus className="mt-0.5 size-3.5 shrink-0 text-sky-700" />}
              <span>
                <span className="font-semibold">
                  {leg.mode === "tram" ? "Tramwaj" : "Autobus"} {leg.line}
                </span>{" "}
                w kierunku: {leg.headsign}
                <br />
                <span className="text-muted-foreground">
                  Wsiądź: {leg.boardStop} ({leg.departs}) · wysiądź: {leg.alightStop} ({leg.arrives}) · {leg.stops} {plPlural(leg.stops, "przystanek", "przystanki", "przystanków")}, {leg.minutes} min
                </span>
              </span>
            </li>
          ),
        )}
      </ol>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {plan.transfers === 0 ? "Bez przesiadek" : `${plan.transfers} ${plPlural(plan.transfers, "przesiadka", "przesiadki", "przesiadek")}`} · wyjście ok. {plan.leaveAt}, przyjazd {plan.arriveAt} · typowy poranek w dzień roboczy, rozkład ZTP Kraków
      </p>
    </div>
  );
}
