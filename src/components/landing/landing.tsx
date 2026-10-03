"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importanceToQuery, type Importance } from "@/lib/scoring/preferences";
import type { Category } from "@/types";
import { Background } from "./background";
import { CategoryOrbit, type OpenState } from "./category-orbit";
import { ChatPanel } from "./chat-panel";
import { levelsFromImportance, levelsToImportance, type Level, type Levels } from "./landing-copy";
import { OsmAttribution } from "@/components/osm-attribution";

export function Landing({ initial }: { initial?: Importance }) {
  const router = useRouter();
  const [levels, setLevels] = useState<Levels>(() => (initial ? levelsFromImportance(initial) : {}));
  const [open, setOpen] = useState<OpenState>(null);
  const hasChips = Object.keys(levels).length > 0;

  function setLevel(category: Category, level: Level) {
    setLevels((prev) => ({ ...prev, [category]: level }));
  }

  function removeLevel(category: Category) {
    setLevels((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  }

  return (
    <main className="relative isolate flex flex-1 flex-col items-center overflow-x-clip px-4 py-8 sm:px-6 sm:py-12">
      <Background />

      <div className="flex w-full max-w-2xl flex-1 flex-col items-center text-center">
        {/* Placeholder for the future logo. */}
        <div
          aria-hidden
          className="mb-6 flex size-14 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-[11px] font-medium text-slate-500"
        >
          logo
        </div>

        <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
          Znajdź w Krakowie miejsce,{" "}
          <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            które pasuje do Ciebie
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-base text-slate-700 sm:text-lg">
          Powiedz, co jest dla Ciebie ważne — pokażemy, które części miasta najlepiej odpowiadają Twojemu stylowi życia.
        </p>

        <div className="mt-8 w-full">
          <CategoryOrbit levels={levels} open={open} onOpenChange={setOpen} onConfirm={setLevel} />
          <p className="mt-3 text-sm text-slate-600">Najedź lub kliknij ikonę, aby ustawić jej ważność.</p>
        </div>

        <div className="mt-6 w-full text-left">
          <ChatPanel
            levels={levels}
            onImportance={(i) => setLevels(levelsFromImportance(i))}
            onEditCategory={(category) => setOpen({ category, via: "external" })}
            onRemoveCategory={removeLevel}
          />
        </div>

        <Button
          type="button"
          disabled={!hasChips}
          onClick={() => router.push(`/map?${importanceToQuery(levelsToImportance(levels))}`)}
          className="mt-6 h-12 gap-2 rounded-full bg-emerald-700 px-8 text-base font-semibold text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:shadow-none"
        >
          Pokaż moją mapę
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <p className="mt-2 text-sm text-slate-600">
          {hasChips ? "Preferencje możesz zmienić w dowolnym momencie." : "Dodaj co najmniej jeden parametr, aby zobaczyć mapę."}
        </p>
      </div>

      <OsmAttribution className="mt-8 text-center" />
    </main>
  );
}
