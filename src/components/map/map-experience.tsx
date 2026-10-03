"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Hexagon } from "lucide-react";
import { AreaPanel } from "./area-panel";
import { HexMap, LEGEND_GRADIENT } from "./hex-map";
import { OsmAttribution } from "@/components/osm-attribution";
import { ModeSelector } from "./mode-selector";
import { importanceToQuery, type Importance } from "@/lib/scoring/preferences";
import { normalizeWeights } from "@/lib/scoring/weights";
import type { HexData, MapMode } from "@/types";

export function MapExperience({ hexes, importance }: { hexes: HexData[]; importance: Importance }) {
  const [mode, setMode] = useState<MapMode>("forYou");
  const [selected, setSelected] = useState<string | null>(null);
  const weights = useMemo(() => normalizeWeights(importance), [importance]);
  const scores = useMemo(
    () => (selected ? (hexes.find((h) => h.h3Index === selected)?.scores ?? null) : null),
    [hexes, selected],
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      <HexMap hexes={hexes} weights={weights} mode={mode} selected={selected} onSelect={setSelected} />

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
          <ModeSelector mode={mode} onChange={setMode} />
        </div>
      </div>

      <aside className="absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto rounded-t-3xl border border-border/70 bg-white/95 shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-16 sm:max-h-[calc(100%-5.5rem)] sm:w-[22rem] sm:rounded-3xl">
        <AreaPanel scores={scores} weights={weights} onClose={() => setSelected(null)} />
      </aside>

      <Legend mode={mode} />
    </div>
  );
}

function Legend({ mode }: { mode: MapMode }) {
  return (
    <div className="pointer-events-none absolute left-3 top-28 rounded-xl border border-border/70 bg-white/90 px-3 py-2 shadow-lg shadow-black/5 backdrop-blur sm:bottom-6 sm:left-4 sm:top-auto">
      <div className="mb-1.5 text-[11px] font-medium text-slate-600">
        {mode === "forYou" ? "Match for you" : "Category score"}
      </div>
      <div className="h-2 w-40 rounded-full" style={{ background: LEGEND_GRADIENT }} />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{mode === "forYou" ? "Weaker match" : "Low"}</span>
        <span>{mode === "forYou" ? "Strong match" : "High"}</span>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        Relative to the rest of Kraków · untinted = average
      </div>
      <OsmAttribution className="pointer-events-auto mt-1" />
    </div>
  );
}
