"use client";

import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_LABELS, type MapMode } from "@/types";

const MODES: { id: MapMode; label: string }[] = [
  { id: "forYou", label: "Dla Ciebie" },
  ...CATEGORIES.map((c) => ({ id: c as MapMode, label: CATEGORY_LABELS[c] })),
];

export function ModeSelector({
  mode,
  onChange,
}: {
  mode: MapMode;
  onChange: (m: MapMode) => void;
}) {
  const modes = MODES;
  return (
    <div
      role="tablist"
      aria-label="Tryb mapy"
      className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border/70 bg-white/90 p-1 shadow-lg shadow-black/5 backdrop-blur"
    >
      {modes.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={mode === m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            mode === m.id
              ? m.id === "forYou"
                ? "bg-emerald-600 text-white shadow"
                : "bg-slate-900 text-white shadow"
              : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
