"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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

export function Landing({ initial }: { initial?: Importance }) {
  const router = useRouter();
  const [importance, setImportance] = useState<Importance | null>(initial ?? null);
  const [stages, setStages] = useState<EducationStage[] | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [rent, setRent] = useState<RentFilter | null>(null);
  const [workplace, setWorkplace] = useState<Workplace | null>(null);
  const [car, setCar] = useState(false);

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-white text-[#222823]">
      <div className="relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-2">
        <HeroStage />

        <section className="relative flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="absolute right-5 top-5 sm:right-8 sm:top-8">
            <SavedMapLink />
          </div>
          <div className="w-full max-w-xl">
            <h1 className="mb-8 text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#1b221d] sm:text-4xl">
              Znajdź część Krakowa, która pasuje do Ciebie.
            </h1>
            <ChatPanel
              onImportance={(i, nextStages, nextAnchor, nextRent, nextWork, nextCar) => {
                setImportance(i);
                setStages(nextStages?.length ? nextStages : null);
                setAnchor(nextAnchor);
                setRent(nextRent);
                setWorkplace(nextWork);
                setCar(nextCar);
              }}
            />
            <Button
              type="button"
              disabled={!importance}
              onClick={() => {
                if (!importance) return;
                const edu = importance.education > 0 && stages ? stagesToParam(stages) : null;
                router.push(`/map?${importanceToQuery(importance)}${edu ? `&edu=${edu}` : ""}${anchor ? `&${anchorToQuery(anchor)}` : ""}${rent ? `&${rentToQuery(rent)}` : ""}${workplace ? `&${workplaceToQuery(workplace)}` : ""}${car ? "&car=1" : ""}`);
              }}
              className="mt-5 h-12 w-full justify-between rounded-none bg-[#252d27] px-5 text-sm font-normal text-white hover:bg-[#39443b] disabled:bg-stone-200 disabled:text-stone-500"
            >
              Pokaż moją mapę
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            {!importance && (
              <p className="mt-2 text-xs text-stone-500">Opisz, czego szukasz, aby zobaczyć mapę.</p>
            )}
          </div>
        </section>
      </div>

      <OsmAttribution className="relative z-10 px-5 pb-3 text-right text-stone-400 sm:px-8 lg:px-12" />
    </main>
  );
}
