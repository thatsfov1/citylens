"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Highlighter } from "@/components/ui/highlighter";
import { Button } from "@/components/ui/button";
import { OsmAttribution } from "@/components/osm-attribution";
import { importanceToQuery, type Importance } from "@/lib/scoring/preferences";
import { stagesToParam } from "@/lib/scoring/education";
import { anchorToQuery, type Anchor } from "@/lib/scoring/anchor";
import { rentToQuery, type RentFilter } from "@/lib/scoring/rent";
import { workplaceToQuery, type Workplace } from "@/lib/scoring/commute";
import type { EducationStage } from "@/types";
import { ChatPanel } from "./chat-panel";
import { SavedMapLink } from "./saved-map-link";
import { HeroStage } from "./hero-stage";

/** Filters carried back from the map; the chat replaces them when it returns a new interpretation. */
export type InitialFilters = {
  stages: EducationStage[] | null;
  anchor: Anchor | null;
  rent: RentFilter | null;
  workplace: Workplace | null;
  car: boolean;
  minSafety: string | null;
};

export function Landing({ initial, initialFilters }: { initial?: Importance; initialFilters?: InitialFilters }) {
  const router = useRouter();
  const [importance, setImportance] = useState<Importance | null>(initial ?? null);
  const [stages, setStages] = useState<EducationStage[] | null>(initialFilters?.stages?.length ? initialFilters.stages : null);
  const [anchor, setAnchor] = useState<Anchor | null>(initialFilters?.anchor ?? null);
  const [rent, setRent] = useState<RentFilter | null>(initialFilters?.rent ?? null);
  const [workplace, setWorkplace] = useState<Workplace | null>(initialFilters?.workplace ?? null);
  const [car, setCar] = useState(initialFilters?.car ?? false);
  const [minSafety, setMinSafety] = useState(initialFilters?.minSafety ?? null);

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-white text-[#222823]">
      <div className="relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-2">
        <HeroStage />

        <section className="relative flex min-h-screen items-start justify-center px-5 pb-10 pt-6 sm:px-8 lg:h-screen lg:min-h-0 lg:px-10 lg:pt-[clamp(1.5rem,4vh,3rem)]">
          <div className="w-full max-w-xl">
            <div className="mb-3 flex h-8 items-start justify-end">
              <SavedMapLink />
            </div>
            <h1 className="mb-6 max-w-lg text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] text-[#1b221d] sm:text-5xl">
              Znajdź część Krakowa, która pasuje do{" "}
              <Highlighter action="highlight" color="#86EFAC">Ciebie</Highlighter>
            </h1>
            <ChatPanel
              onImportance={(i, nextStages, nextAnchor, nextRent, nextWork, nextCar) => {
                setImportance(i);
                setStages(nextStages?.length ? nextStages : null);
                setAnchor(nextAnchor);
                setRent(nextRent);
                setWorkplace(nextWork);
                setCar(nextCar);
                setMinSafety(null);
              }}
            />
            <Button
              type="button"
              disabled={!importance}
              onClick={() => {
                if (!importance) return;
                const edu = importance.education > 0 && stages ? stagesToParam(stages) : null;
                router.push(`/map?${importanceToQuery(importance)}${edu ? `&edu=${edu}` : ""}${anchor ? `&${anchorToQuery(anchor)}` : ""}${rent ? `&${rentToQuery(rent)}` : ""}${workplace ? `&${workplaceToQuery(workplace)}` : ""}${car ? "&car=1" : ""}${minSafety ? `&minSafety=${minSafety}` : ""}`);
              }}
              className="mt-5 h-12 w-full justify-between rounded-xl bg-[#252d27] px-5 text-sm font-normal text-white shadow-sm hover:bg-[#39443b] disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none"
            >
              Pokaż moją mapę
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            {!importance && (
              <p className="mt-2 text-xs text-stone-500">Opisz, czego szukasz, aby zobaczyć mapę.</p>
            )}
          </div>
          <OsmAttribution className="absolute bottom-3 right-5 text-right text-stone-400 sm:right-8 lg:right-10" />
        </section>
      </div>
    </main>
  );
}
