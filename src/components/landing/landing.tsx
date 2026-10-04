"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { UseCaseCallouts } from "./use-case-callouts";

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
        <section aria-label="Mapa Krakowa" className="relative min-h-[38vh] overflow-hidden sm:min-h-[44vh] lg:min-h-screen">
          <video
            aria-hidden="true"
            tabIndex={-1}
            disablePictureInPicture
            className="motion-reduce:hidden absolute inset-0 size-full object-cover"
            src="/videos/krakow.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-white/50" />
          <UseCaseCallouts />
          <Link
            href="/"
            aria-label="Citylens — strona główna"
            className="absolute bottom-5 left-5 z-20 flex items-center justify-center gap-2 text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:bottom-7 sm:left-7"
          >
            <span aria-hidden="true" className="relative size-6 rounded-full border-2 border-current sm:size-7">
              <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
            </span>
            <span className="font-[family-name:var(--font-bricolage)] text-4xl font-semibold leading-none tracking-[-0.06em] sm:text-5xl lg:text-6xl">
              citylens.
            </span>
          </Link>
        </section>

        <section className="relative flex min-h-screen items-start justify-center px-5 py-6 sm:px-8 lg:h-screen lg:min-h-0 lg:px-10 lg:py-[clamp(1.5rem,4vh,3rem)]">
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
              className="mt-5 h-12 w-full justify-between rounded-xl bg-[#252d27] px-5 text-sm font-normal text-white shadow-sm hover:bg-[#39443b] disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none"
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
