"use client";

import { SourceBadges } from "./source-badge";
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
export function RentFilter({
  value,
  onChange,
  car = false,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
  car?: boolean;
}) {
  const active = isRentActive(value);
  const fee = cityRent(value.rooms)?.fee ?? null;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold tabular-nums">
          Miesięczny wynajem: {formatRentRange(value)}
        </div>
        {active && (
          <button
            type="button"
            onClick={() => onChange({ ...value, min: RENT_MIN, max: RENT_MAX })}
            className="text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Resetuj zakres
          </button>
        )}
      </div>
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
        aria-label="Zakres miesięcznego wynajmu"
      />
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatZl(RENT_MIN)}</span>
        <span>{formatZl(RENT_MAX)}+</span>
      </div>
      <div
        role="radiogroup"
        aria-label="Wielkość mieszkania"
        className="mt-3 flex gap-1 rounded-full bg-muted p-1"
      >
        {ROOMS_OPTIONS.map((r) => (
          <button
            key={r.value}
            role="radio"
            aria-checked={value.rooms === r.value}
            onClick={() => onChange({ ...value, rooms: r.value })}
            className={`flex-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
              value.rooms === r.value
                ? "bg-white text-slate-900 shadow"
                : "text-slate-600 hover:text-slate-900"
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
          <span className="font-medium text-slate-900">
            Budżet obejmuje czynsz administracyjny (szacunkowo)
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {value.fees
              ? "Każda oferta jest liczona jako cena wynajmu plus jej czynsz administracyjny."
              : "Z budżetem porównywana jest tylko cena wynajmu z ogłoszenia."}
          </span>
        </span>
      </label>

      <div className="mt-2 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-900">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          Ogłoszenia zwykle pokazują <b>samą cenę wynajmu</b>.{" "}
          <b>Czynsz administracyjny</b> dolicza się osobno
          {fee
            ? `, zwykle ok. ${formatZl(fee)} dla tej wielkości mieszkania`
            : ""}
          , a opłaty (media, internet) często są jeszcze dodatkowe. Sprawdź, co
          obejmuje oferta, zanim zaufasz cenie.
          {car &&
            " Miejsce w garażu lub abonament parkingowy dla mieszkańców to zwykle kolejny miesięczny koszt."}
        </p>
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {active
          ? "Mapa blednie tam, gdzie pasuje niewiele ofert z dzielnicy, a takie dzielnice są pomijane w „Najmocniejszych obszarach”. Dzielnice ze zbyt małą liczbą ogłoszeń pozostają lekko zacieniowane."
          : "Opcjonalnie: wyszarz dzielnice, w których mało ofert mieści się w Twoim budżecie."}{" "}
        Ceny ofertowe z {RENT_META.listings.toLocaleString("pl")} ogłoszeń na
        Otodom.pl (stan na {RENT_META.snapshot}), według dzielnic.
      </p>
      <SourceBadges
        topic="rent"
        asOf={{ otodom: RENT_META.snapshot }}
        className="mt-1.5"
      />
      <a
        href={otodomUrl(value)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
      >
        Zobacz te oferty na Otodom
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </div>
  );
}

const FIT_BADGE = {
  in: { text: "Większość ofert", style: "bg-emerald-50 text-emerald-700" },
  some: { text: "Część ofert", style: "bg-amber-50 text-amber-700" },
  out: { text: "Niewiele ofert", style: "bg-slate-100 text-slate-600" },
} as const;

/** The selected area's typical rent for the chosen flat size: base + czynsz, and how many offers fit the budget. */
export function RentSection({
  stats,
  fee,
  share,
  within,
  fit,
  filter,
  district,
}: RentSummary & { filter: Filter; district: string | null }) {
  const size = ROOMS_OPTIONS.find((r) => r.value === filter.rooms)?.label ?? "";
  const badge = fit === "unknown" ? null : FIT_BADGE[fit];
  const place = district ?? "ta dzielnica";
  return (
    <div className="mt-5 rounded-2xl border border-border/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Banknote className="size-4" />
          Typowy wynajem · {size}
        </div>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.style}`}
          >
            {badge.text}
          </span>
        )}
      </div>
      {stats ? (
        <>
          <dl className="mt-2 space-y-0.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Cena wynajmu (mediana)</dt>
              <dd className="font-medium tabular-nums">
                {formatZl(stats.median)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Czynsz administracyjny (typowy, dodatkowo)
              </dt>
              <dd className="font-medium tabular-nums">
                {fee ? `+ ${formatZl(fee)}` : "brak danych"}
              </dd>
            </div>
            {fee > 0 && (
              <div className="flex justify-between border-t border-border/70 pt-1 text-base font-semibold">
                <dt>Razem miesięcznie</dt>
                <dd className="tabular-nums">{formatZl(stats.median + fee)}</dd>
              </div>
            )}
          </dl>
          <div className="mt-1 text-xs text-muted-foreground">
            Środkowa połowa cen wynajmu: {formatZl(stats.p25)} –{" "}
            {formatZl(stats.p75)}
          </div>
          {share !== null && (
            <div className="mt-2 text-sm">
              <b>{within}</b> z {stats.n} ofert mieści się w Twoim budżecie
              {filter.fees
                ? " (z czynszem administracyjnym)"
                : " (tylko cena wynajmu)"}
              .
            </div>
          )}
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Ceny ofertowe (dzielnica: {place}) z {stats.n} ogłoszeń na Otodom.pl
            ({RENT_META.snapshot})
            {stats.n < 15 ? ", mało ofert, traktuj orientacyjnie" : ""}. To
            szacunek dla całej dzielnicy, a nie dla tego sześciokąta. Opłaty
            (media, internet) zwykle są dodatkowe.
          </p>
          <SourceBadges
            topic="rent"
            asOf={{ otodom: RENT_META.snapshot }}
            className="mt-1.5"
          />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Zbyt mało ogłoszeń dla tej wielkości mieszkania ({size.toLowerCase()}
          ), dzielnica: {place}.
        </p>
      )}
      <a
        href={otodomUrl(filter, district)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
      >
        Zobacz aktualne oferty{district ? ` (${district})` : ""} na Otodom
        <ExternalLink className="size-3" aria-hidden />
      </a>
      {filter.fees && isRentActive(filter) && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Otodom filtruje po cenie wynajmu, więc limity cen są tam obniżone o
          typowy czynsz administracyjny.
        </p>
      )}
    </div>
  );
}
