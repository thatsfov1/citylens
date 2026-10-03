"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importanceToQuery, type Importance } from "@/lib/scoring/preferences";
import { stagesToParam } from "@/lib/scoring/education";
import type { Category, EducationStage } from "@/types";
import { Background } from "./background";
import { CategoryOrbit, type OpenState } from "./category-orbit";
import { ChatPanel } from "./chat-panel";
import { levelsFromImportance, levelsToImportance, type Level, type Levels } from "./landing-copy";
import { OsmAttribution } from "@/components/osm-attribution";

export function Landing({ initial }: { initial?: Importance }) {
  const router = useRouter();
  const [levels, setLevels] = useState<Levels>(() => (initial ? levelsFromImportance(initial) : {}));
  const [open, setOpen] = useState<OpenState>(null);
  // Education life stages the assistant picked up from the chat (e.g. a toddler → kindergarten); null = all.
  const [stages, setStages] = useState<EducationStage[] | null>(null);
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
          className="mb-6 flex size-14 items-center justify-center rounded-2xl border-2 border-dashed border-cream/40 text-[11px] font-medium text-cream/80"
        >
          logo
        </div>

        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-cream [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] sm:text-6xl">
          Znajdź w <em className="font-display font-normal italic">Krakowie</em> miejsce, które pasuje do{" "}
          <em className="font-display font-normal italic">Ciebie</em>
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-base text-cream/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.6)] sm:text-lg">
          Powiedz, co jest dla Ciebie ważne — pokażemy, które części miasta najlepiej odpowiadają Twojemu stylowi życia.
        </p>

        <div className="mt-8 w-full">
          <CategoryOrbit levels={levels} open={open} onOpenChange={setOpen} onConfirm={setLevel} />
          <p className="mt-3 text-sm text-cream/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">Najedź lub kliknij ikonę, aby ustawić jej ważność.</p>
        </div>

        <div className="mt-6 w-full text-left">
          <ChatPanel
            levels={levels}
            onImportance={(i, s) => {
              setLevels(levelsFromImportance(i));
              setStages(s && s.length ? s : null);
            }}
            onEditCategory={(category) => setOpen({ category, via: "external" })}
            onRemoveCategory={removeLevel}
          />
        </div>

        <Button
          type="button"
          disabled={!hasChips}
          onClick={() => {
            const edu = stages && levels.education ? stagesToParam(stages) : null;
            router.push(`/map?${importanceToQuery(levelsToImportance(levels))}${edu ? `&edu=${edu}` : ""}`);
          }}
          className="mt-6 h-12 gap-2 rounded-full bg-moss px-8 text-base font-semibold text-white shadow-lg shadow-bark/20 hover:bg-bark disabled:bg-white/15 disabled:text-cream/70 disabled:shadow-none"
        >
          Pokaż moją mapę
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <p className="mt-2 text-sm text-cream/80 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
          {hasChips ? "Preferencje możesz zmienić w dowolnym momencie." : "Dodaj co najmniej jeden parametr, aby zobaczyć mapę."}
        </p>
      </div>

      <OsmAttribution className="mt-8 text-center text-cream/70" />
    </main>
  );
}
