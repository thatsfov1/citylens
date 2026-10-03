"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OsmAttribution } from "@/components/osm-attribution";
import { importanceToQuery, type Importance } from "@/lib/scoring/preferences";
import { stagesToParam } from "@/lib/scoring/education";
import { anchorToQuery, type Anchor } from "@/lib/scoring/anchor";
import { rentToQuery, type RentFilter } from "@/lib/scoring/rent";
import type { EducationStage } from "@/types";
import { ChatPanel } from "./chat-panel";

export function Landing({ initial }: { initial?: Importance }) {
  const router = useRouter();
  const [importance, setImportance] = useState<Importance | null>(initial ?? null);
  const [stages, setStages] = useState<EducationStage[] | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [rent, setRent] = useState<RentFilter | null>(null);

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-white text-[#222823]">
      <header className="relative z-10 flex items-center justify-between border-b border-stone-200 px-5 py-4 sm:px-8 lg:px-12">
        <div>
          <Link href="/" className="text-lg font-medium tracking-[-0.04em] text-[#222823]">citylens</Link>
          <p className="mt-0.5 text-xs font-light tracking-wide text-stone-500">Kraków widziany po Twojemu</p>
        </div>
        <span className="text-[10px] font-normal uppercase tracking-[0.22em] text-stone-500">Kraków · Polska</span>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-2">
        <section aria-label="Mapa Krakowa" className="relative min-h-[38vh] overflow-hidden sm:min-h-[44vh] lg:min-h-[calc(100vh-5rem)]">
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
        </section>

        <section className="relative flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-xl">
            <ChatPanel
              onImportance={(i, nextStages, nextAnchor, nextRent) => {
                setImportance(i);
                setStages(nextStages?.length ? nextStages : null);
                setAnchor(nextAnchor);
                setRent(nextRent);
              }}
            />
            {importance && (
              <Button
                type="button"
                onClick={() => {
                  const edu = importance.education > 0 && stages ? stagesToParam(stages) : null;
                  router.push(`/map?${importanceToQuery(importance)}${edu ? `&edu=${edu}` : ""}${anchor ? `&${anchorToQuery(anchor)}` : ""}${rent ? `&${rentToQuery(rent)}` : ""}`);
                }}
                className="mt-5 h-12 w-full justify-between rounded-none bg-[#252d27] px-5 text-sm font-normal text-white hover:bg-[#39443b]"
              >
                Pokaż moją mapę
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </section>
      </div>

      <OsmAttribution className="relative z-10 px-5 pb-3 text-right text-stone-400 sm:px-8 lg:px-12" />
    </main>
  );
}
