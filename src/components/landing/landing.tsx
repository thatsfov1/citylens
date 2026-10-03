"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importanceToQuery, type Importance } from "@/lib/scoring/preferences";
import type { Category } from "@/types";
import { CategoryOrbit, type OpenState } from "./category-orbit";
import { Background } from "./background";
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
    <main className="font-landing relative isolate flex flex-1 flex-col items-center overflow-x-clip px-4 py-8 text-black sm:px-6 sm:py-12">
      <Background />

      <div className="flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6">
        <h1 className="font-title text-balance text-center text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Znajdź w Krakowie miejsce, które pasuje do Ciebie
        </h1>

        <ChatPanel
          levels={levels}
          onImportance={(i) => setLevels(levelsFromImportance(i))}
          onEditCategory={(category) => setOpen({ category, via: "external" })}
          onRemoveCategory={removeLevel}
        />

        <div className="w-full">
          <p className="mb-2 text-center text-xs text-black/70">Albo ustaw ważność ręcznie</p>
          <CategoryOrbit levels={levels} open={open} onOpenChange={setOpen} onConfirm={setLevel} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            disabled={!hasChips}
            onClick={() => router.push(`/map?${importanceToQuery(levelsToImportance(levels))}`)}
            className="h-12 gap-2 rounded-full bg-black px-8 text-base font-semibold text-white hover:bg-black/80 disabled:bg-black/10 disabled:text-black/50"
          >
            Pokaż moją mapę
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <p className="text-sm text-black/70">
            {hasChips ? "Preferencje możesz zmienić w dowolnym momencie." : "Dodaj co najmniej jeden parametr, aby zobaczyć mapę."}
          </p>
        </div>
      </div>

      <OsmAttribution className="mt-8 text-center text-black/60" />
    </main>
  );
}
