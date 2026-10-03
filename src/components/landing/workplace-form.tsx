"use client";

import { useState, type FormEvent } from "react";
import { Briefcase, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMUTE_LIMITS_MIN, DEFAULT_COMMUTE_MIN, TRAVEL_MODES, type TravelMode, type Workplace } from "@/lib/scoring/commute";

const MODE_PL: Record<TravelMode, string> = { walk: "Pieszo", bike: "Rower", transit: "Komunikacja", car: "Samochód" };

type Props = { value: Workplace | null; onChange: (w: Workplace | null) => void };

/** Optional: where the user works, how they get there and how long a commute they accept. */
export function WorkplaceForm({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<TravelMode>(value?.mode ?? "transit");
  const [maxMin, setMaxMin] = useState<number>(value?.maxMin ?? DEFAULT_COMMUTE_MIN);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode and limit apply to an already resolved workplace immediately.
  const update = (next: { mode?: TravelMode; maxMin?: number }) => {
    if (next.mode) setMode(next.mode);
    if (next.maxMin) setMaxMin(next.maxMin);
    if (value) onChange({ ...value, ...next });
  };

  async function resolve(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2 || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) {
        setError("Nie znaleziono takiego miejsca w Krakowie. Spróbuj podać adres lub nazwę firmy.");
        return;
      }
      const hit = (await res.json()) as { name: string; lat: number; lng: number };
      onChange({ name: hit.name, lat: hit.lat, lng: hit.lng, mode, maxMin });
      setQuery("");
    } catch {
      setError("Nie udało się wyszukać miejsca. Spróbuj ponownie.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="Miejsce pracy" className="mt-6 border-t border-stone-200 pt-5">
      <div className="flex items-center gap-2 text-xs font-normal uppercase tracking-[0.18em] text-stone-500">
        <Briefcase className="size-3.5" aria-hidden />
        Dojazd do pracy (opcjonalnie)
      </div>

      {value ? (
        <div className="mt-3 flex items-center justify-between gap-3 border-l border-stone-300 py-1 pl-4 text-sm text-[#303731]">
          <span className="flex min-w-0 items-center gap-2">
            <Check className="size-4 shrink-0 text-emerald-700" aria-hidden />
            <span className="truncate">{value.name.split(",")[0]}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Usuń miejsce pracy"
            className="shrink-0 p-1 text-stone-500 hover:text-stone-800"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={resolve} className="mt-3 flex gap-2 border-b border-stone-300 pb-1 focus-within:border-stone-700">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={120}
            placeholder="Adres lub nazwa miejsca pracy…"
            aria-label="Adres miejsca pracy"
            className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm font-light outline-none placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={pending || query.trim().length < 2}
            className="px-3 text-sm text-[#252d27] underline-offset-4 hover:underline disabled:text-stone-400 disabled:no-underline"
          >
            {pending ? "Szukam…" : "Dodaj"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-stone-600">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sposób dojazdu">
        {TRAVEL_MODES.map((m) => (
          <Chip key={m} active={mode === m} onClick={() => update({ mode: m })}>
            {MODE_PL[m]}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Maksymalny czas dojazdu">
        <span className="mr-1 text-xs text-stone-500">Maks.</span>
        {COMMUTE_LIMITS_MIN.map((m) => (
          <Chip key={m} active={maxMin === m} onClick={() => update({ maxMin: m })}>
            {m} min
          </Chip>
        ))}
      </div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "border px-3 py-1 text-xs transition-colors",
        active ? "border-[#252d27] bg-[#252d27] text-white" : "border-stone-300 text-stone-600 hover:border-stone-500",
      )}
    >
      {children}
    </button>
  );
}
