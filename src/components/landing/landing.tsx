"use client";

import { Fragment, useCallback, useEffect, useState, type CSSProperties, type PointerEvent } from "react";
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
import { Intro } from "./intro";
import { CursorFollower } from "./cursor-follower";
import { Magnetic } from "./magnetic";
import { ScrollSections } from "./scroll-sections";

const HEADLINE = ["Znajdź", "część", "Krakowa,", "która", "pasuje", "do", "Ciebie."];
const ACCENT_FROM = 4; // "pasuje do Ciebie." gets the animated gradient

const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export function Landing({ initial }: { initial?: Importance }) {
  const router = useRouter();
  const [importance, setImportance] = useState<Importance | null>(initial ?? null);
  const [stages, setStages] = useState<EducationStage[] | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [rent, setRent] = useState<RentFilter | null>(null);
  const [workplace, setWorkplace] = useState<Workplace | null>(null);
  const [car, setCar] = useState(false);
  // The intro plays once per browser session and never when returning from the map.
  const [stage, setStage] = useState<"intro" | "ready">("intro");
  const [introGone, setIntroGone] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("cl-intro") === "1";
    } catch {}
    if (!(seen || initial || window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const id = requestAnimationFrame(() => {
      setStage("ready");
      setIntroGone(true);
    });
    return () => cancelAnimationFrame(id);
  }, [initial]);

  const reveal = useCallback(() => setStage("ready"), []);
  const introDone = useCallback(() => {
    try {
      sessionStorage.setItem("cl-intro", "1");
    } catch {}
    setIntroGone(true);
  }, []);

  function onSpotlight(e: PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <main data-stage={stage} className="relative isolate flex min-h-screen flex-col overflow-hidden bg-white text-[#222823]">
      {!introGone && <Intro onReveal={reveal} onDone={introDone} />}
      <CursorFollower />
      <div aria-hidden className="lm-grain pointer-events-none absolute inset-0 z-30" />
      <div className="relative z-10 mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-2">
        <HeroStage />

        <section
          onPointerMove={onSpotlight}
          className="relative flex items-center justify-center overflow-hidden px-5 py-8 sm:px-8 lg:px-10"
        >
          <div aria-hidden className="lm-blob lm-blob-a" />
          <div aria-hidden className="lm-blob lm-blob-b" />
          <div aria-hidden className="lm-spotlight pointer-events-none absolute inset-0" />
          <div className="lm-in absolute right-5 top-5 z-10 sm:right-8 sm:top-8" style={delay(1.4)}>
            <SavedMapLink />
          </div>
          <div className="relative w-full max-w-xl">
            <p className="lm-in mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-stone-500" style={delay(0.1)}>
              <span className="lm-live size-2 rotate-45 bg-emerald-500" />
              Kraków · mapa dopasowania
            </p>
            <h1 className="mb-8 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-[#1b221d] sm:text-5xl">
              {HEADLINE.map((word, i) => (
                <Fragment key={word}>
                  <span className="lm-mask">
                    <span
                      className={i >= ACCENT_FROM ? "lm-rise font-display font-normal italic lm-gradient-text" : "lm-rise"}
                      style={delay(0.15 + i * 0.07)}
                    >
                      {word}
                    </span>
                  </span>{" "}
                </Fragment>
              ))}
            </h1>
            <div className="lm-in" style={delay(0.75)}>
            <ChatPanel
              enabled={stage === "ready"}
              onImportance={(i, nextStages, nextAnchor, nextRent, nextWork, nextCar) => {
                setImportance(i);
                setStages(nextStages?.length ? nextStages : null);
                setAnchor(nextAnchor);
                setRent(nextRent);
                setWorkplace(nextWork);
                setCar(nextCar);
              }}
            />
            </div>
            <div className="lm-in" style={delay(0.95)}>
            <Magnetic>
            <Button
              type="button"
              disabled={!importance}
              onClick={() => {
                if (!importance) return;
                const edu = importance.education > 0 && stages ? stagesToParam(stages) : null;
                router.push(`/map?${importanceToQuery(importance)}${edu ? `&edu=${edu}` : ""}${anchor ? `&${anchorToQuery(anchor)}` : ""}${rent ? `&${rentToQuery(rent)}` : ""}${workplace ? `&${workplaceToQuery(workplace)}` : ""}${car ? "&car=1" : ""}`);
              }}
              className="lm-btn group relative mt-5 h-12 w-full justify-between overflow-hidden rounded-none bg-[#252d27] px-5 text-sm font-normal text-white hover:bg-[#39443b] disabled:bg-stone-200 disabled:text-stone-500"
            >
              <span aria-hidden className="lm-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/25" />
              <span className="relative">Pokaż moją mapę</span>
              <ArrowRight className="relative size-4 transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden />
            </Button>
            </Magnetic>
            {!importance && (
              <p className="mt-2 text-xs text-stone-500">Opisz, czego szukasz, aby zobaczyć mapę.</p>
            )}
            </div>
          </div>
        </section>
      </div>

      <ScrollSections />

      <OsmAttribution className="lm-in relative z-10 px-5 pb-3 text-right text-stone-400 sm:px-8 lg:px-12" />
    </main>
  );
}
