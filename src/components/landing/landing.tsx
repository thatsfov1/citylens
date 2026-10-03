"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importanceToQuery, type Importance } from "@/lib/scoring/preferences";
import type { Category } from "@/types";
import { CategoryOrbit, type OpenState } from "./category-orbit";
import { ChatPanel } from "./chat-panel";
import { KrakowShape } from "./krakow-shape";
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
    <main className="font-landing relative isolate flex flex-1 flex-col items-center overflow-x-clip bg-[#ebebeb] px-4 py-8 text-black sm:px-6 sm:py-12">
      <h1 className="max-w-3xl text-balance text-center text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
        Znajdź w <AccentWord>Krakowie</AccentWord> miejsce, które pasuje do <AccentWord>Ciebie</AccentWord>
      </h1>

      <div className="mt-10 grid w-full max-w-6xl flex-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="mx-auto w-full max-w-xl">
          <KrakowShape />
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
          <ChatPanel
            levels={levels}
            onImportance={(i) => setLevels(levelsFromImportance(i))}
            onEditCategory={(category) => setOpen({ category, via: "external" })}
            onRemoveCategory={removeLevel}
          />

          <div>
            <p className="mb-2 text-center text-xs text-black/60">Albo ustaw ważność ręcznie</p>
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
            <p className="text-sm text-black/60">
              {hasChips ? "Preferencje możesz zmienić w dowolnym momencie." : "Dodaj co najmniej jeden parametr, aby zobaczyć mapę."}
            </p>
          </div>
        </div>
      </div>

      <OsmAttribution className="mt-8 text-center text-black/50" />
    </main>
  );
}

/** Script word drawn twice, the back copy offset and softened, so the two layers overlap into a shadow. */
function AccentWord({ children }: { children: string }) {
  return (
    <span className="relative inline-block font-script text-[1.5em] font-normal leading-none">
      <span aria-hidden className="absolute left-[0.04em] top-[0.07em] select-none text-black/25 blur-[1.5px]">
        {children}
      </span>
      <span className="relative">{children}</span>
    </span>
  );
}
