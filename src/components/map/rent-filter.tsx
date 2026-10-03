"use client";

import { Banknote, ExternalLink, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  RENT_MAX,
  RENT_META,
  RENT_MIN,
  RENT_STEP,
  ROOMS_OPTIONS,
  cityRent,
  formatRentRange,
  formatZl,
  otodomUrl,
  type RentFilter as Filter,
  type RentSummary,
} from "@/lib/scoring/rent";

export const isRentActive = (f: Filter) => f.min > RENT_MIN || f.max < RENT_MAX;

/** Monthly rent budget: two handles (the ends mean "no limit"), the flat size, and whether czynsz counts. */
export function RentFilter({ value, onChange, inline = false, car = false }: { value: Filter; onChange: (v: Filter) => void; inline?: boolean; car?: boolean }) {
  const active = isRentActive(value);
  const fee = cityRent(value.rooms)?.fee ?? null;
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

      <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-muted/60 p-2.5">
        <input
          type="checkbox"
          checked={value.fees}
          onChange={(e) => onChange({ ...value, fees: e.target.checked })}
          className="mt-0.5 size-4 shrink-0 accent-emerald-600"
        />
        <span className="text-xs leading-snug">
          <span className="font-medium text-slate-900">Budget includes czynsz (estimated)</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {value.fees ? "Each offer is counted as base rent plus its czynsz." : "Only the base rent shown in the ad is compared with your budget."}
          </span>
        </span>
      </label>

      <div className="mt-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-900">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          Ads usually show the <b>base rent only</b>. The building fee (<b>czynsz administracyjny</b>) is added on top
          {fee ? `, typically about ${formatZl(fee)} for this flat size` : ""}, and utilities (media, internet) are
          often extra again. Check what an offer includes before you rely on the price.
          {car && " A garage space or resident parking permit is usually an extra monthly cost too."}
        </p>
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {active
          ? "The map fades where few of a district's offers fit, and those districts are left out of “Strongest areas”. Districts with too few listings stay lightly shaded."
          : "Optional: fade out districts where few offers fit your budget."}{" "}
        Asking prices from {RENT_META.listings.toLocaleString("en")} listings on Otodom.pl (snapshot {RENT_META.snapshot}), per district.
      </p>
      <a
        href={otodomUrl(value)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
      >
        Browse these offers on Otodom
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </div>
  );
}

const FIT_BADGE = {
  in: { text: "Most offers fit", style: "bg-emerald-50 text-emerald-700" },
  some: { text: "Some offers fit", style: "bg-amber-50 text-amber-700" },
  out: { text: "Few offers fit", style: "bg-slate-100 text-slate-600" },
} as const;

/** The selected area's typical rent for the chosen flat size: base + czynsz, and how many offers fit the budget. */
export function RentSection({ stats, fee, share, within, fit, filter, district }: RentSummary & { filter: Filter; district: string | null }) {
  const size = ROOMS_OPTIONS.find((r) => r.value === filter.rooms)?.label ?? "";
  const badge = fit === "unknown" ? null : FIT_BADGE[fit];
  const place = district ?? "this district";
  return (
    <div className="mt-5 rounded-2xl border border-border/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Banknote className="size-4" />
          Typical rent · {size}
        </div>
        {badge && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.style}`}>{badge.text}</span>}
      </div>
      {stats ? (
        <>
          <dl className="mt-2 space-y-0.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Base rent (median)</dt>
              <dd className="font-medium tabular-nums">{formatZl(stats.median)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Czynsz (typical, extra)</dt>
              <dd className="font-medium tabular-nums">{fee ? `+ ${formatZl(fee)}` : "unknown"}</dd>
            </div>
            {fee > 0 && (
              <div className="flex justify-between border-t border-border/70 pt-1 text-base font-semibold">
                <dt>About a month</dt>
                <dd className="tabular-nums">{formatZl(stats.median + fee)}</dd>
              </div>
            )}
          </dl>
          <div className="mt-1 text-xs text-muted-foreground">
            Middle half of base rents: {formatZl(stats.p25)} – {formatZl(stats.p75)}
          </div>
          {share !== null && (
            <div className="mt-2 text-sm">
              <b>{within}</b> of {stats.n} offers fit your budget{filter.fees ? " (czynsz included)" : " (base rent only)"}.
            </div>
          )}
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Asking prices in {place} from {stats.n} listings on Otodom.pl ({RENT_META.snapshot}){stats.n < 15 ? ", few offers, treat as rough" : ""}.
            An estimate for the whole district, not for this hexagon. Utilities (media, internet) are usually extra.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Too few listings for {size.toLowerCase()} flats in {place} to estimate.</p>
      )}
      <a
        href={otodomUrl(filter, district)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
      >
        See current offers{district ? ` in ${district}` : ""} on Otodom
        <ExternalLink className="size-3" aria-hidden />
      </a>
      {filter.fees && isRentActive(filter) && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">Otodom filters base rent, so the price limits there are lowered by the typical czynsz.</p>
      )}
    </div>
  );
}
