"use client";

import { Banknote } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  RENT_MAX,
  RENT_META,
  RENT_MIN,
  RENT_STEP,
  ROOMS_OPTIONS,
  formatRentRange,
  formatZl,
  type RentFilter as Filter,
  type RentFit,
  type RentStats,
  type Rooms,
} from "@/lib/scoring/rent";

export const isRentActive = (f: Filter) => f.min > RENT_MIN || f.max < RENT_MAX;

/** Monthly rent budget: two handles (the ends mean "no limit") and the flat size the district prices refer to. */
export function RentFilter({ value, onChange, inline = false }: { value: Filter; onChange: (v: Filter) => void; inline?: boolean }) {
  const active = isRentActive(value);
  return (
    <div className={inline ? "" : "border-b border-border/70 px-5 py-3"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Banknote className="size-3.5" />
          Monthly rent budget
        </div>
        {active && (
          <button
            type="button"
            onClick={() => onChange({ ...value, min: RENT_MIN, max: RENT_MAX })}
            className="text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>
      <div className="mt-2 text-sm font-semibold tabular-nums">{formatRentRange(value)}</div>
      <Slider
        className="mt-3"
        min={RENT_MIN}
        max={RENT_MAX}
        step={RENT_STEP}
        minStepsBetweenValues={1}
        value={[value.min, value.max]}
        onValueChange={(v) => {
          const [min, max] = v as number[];
          onChange({ ...value, min, max });
        }}
        aria-label="Monthly rent range"
      />
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatZl(RENT_MIN)}</span>
        <span>{formatZl(RENT_MAX)}+</span>
      </div>
      <div role="radiogroup" aria-label="Flat size" className="mt-3 flex gap-1 rounded-full bg-muted p-1">
        {ROOMS_OPTIONS.map((r) => (
          <button
            key={r.value}
            role="radio"
            aria-checked={value.rooms === r.value}
            onClick={() => onChange({ ...value, rooms: r.value })}
            className={`flex-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
              value.rooms === r.value ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {active
          ? "Districts whose typical rent is outside the range are greyed out and left out of “Strongest areas”. Districts with too few listings stay lightly shaded."
          : "Optional: grey out districts whose typical asking rent is outside your budget."}{" "}
        Asking prices from {RENT_META.listings.toLocaleString("en")} listings (Otodom, {RENT_META.snapshot}), per district.
      </p>
    </div>
  );
}

/** The typical rent of the selected area for the chosen flat size, with how it fits the budget. */
export function RentSection({ stats, rooms, fit, district }: { stats: RentStats | null; rooms: Rooms; fit: RentFit; district: string | null }) {
  const size = ROOMS_OPTIONS.find((r) => r.value === rooms)?.label ?? "";
  return (
    <div className="mt-5 rounded-2xl border border-border/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Banknote className="size-4" />
          Typical rent · {size}
        </div>
        {fit !== "unknown" && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              fit === "in" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {fit === "in" ? "Within budget" : "Outside budget"}
          </span>
        )}
      </div>
      {stats ? (
        <>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatZl(stats.median)}</div>
          <div className="text-xs text-muted-foreground">
            Middle half of offers: {formatZl(stats.p25)} – {formatZl(stats.p75)} / month
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Asking prices in {district ?? "this district"} from {stats.n} listings{stats.n < 15 ? " (few offers, treat as rough)" : ""}. An estimate for the whole district, not for this hexagon.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Too few listings for {size.toLowerCase()} flats in {district ?? "this district"} to estimate.</p>
      )}
    </div>
  );
}
