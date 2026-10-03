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
    <main className="font-landing relative isolate flex flex-1 flex-col items-center overflow-x-clip px-4 py-8 sm:px-6 sm:py-12">
      <Background />

      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-5 text-center">
        <h1 className="text-balance text-3xl font-semibold leading-[1.05] tracking-tight text-mist [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] sm:text-5xl">
          Znajdź w <AccentWord>Krakowie</AccentWord> miejsce, które pasuje do{" "}
          <AccentWord>Ciebie</AccentWord>
        </h1>

        <div className="w-full text-left">
          <ChatPanel
            levels={levels}
            onImportance={(i) => setLevels(levelsFromImportance(i))}
            onEditCategory={(category) => setOpen({ category, via: "external" })}
            onRemoveCategory={removeLevel}
          />
        </div>

        <div className="w-full">
          <p className="mb-2 text-xs text-mist/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">Albo ustaw ważność ręcznie</p>
          <CategoryOrbit levels={levels} open={open} onOpenChange={setOpen} onConfirm={setLevel} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            disabled={!hasChips}
            onClick={() => router.push(`/map?${importanceToQuery(levelsToImportance(levels))}`)}
            className="h-12 gap-2 rounded-full bg-coral px-8 text-base font-semibold text-ink shadow-lg shadow-black/30 hover:bg-coral/85 disabled:bg-white/15 disabled:text-mist/60 disabled:shadow-none"
          >
            Pokaż moją mapę
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <p className="text-sm text-mist/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            {hasChips ? "Preferencje możesz zmienić w dowolnym momencie." : "Dodaj co najmniej jeden parametr, aby zobaczyć mapę."}
          </p>
        </div>
      </div>

      <OsmAttribution className="mt-8 text-center text-mist/70" />
    </main>
  );
}

/** Script word drawn twice, the back copy offset and softened, so the two layers overlap into a shadow. */
function AccentWord({ children }: { children: string }) {
  return (
    <span className="relative inline-block font-script text-[1.5em] font-normal leading-none">
      <span aria-hidden className="absolute left-[0.04em] top-[0.07em] select-none text-aqua/60 blur-[1.5px]">
        {children}
      </span>
      <span className="relative text-coral">{children}</span>
    </span>
  );
}
