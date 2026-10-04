"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { CATEGORIES } from "@/types";
import { CATEGORY_PL, CATEGORY_STYLE } from "./landing-copy";
import { HexField } from "./hex-field";
import { KrakowMap } from "./krakow-shape";
import { SnakeGame } from "./snake-game";

const delayStyle = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

const LETTERS = "citylens".split("");

/** Left half: Kraków outline with the city video inside, interactive hexagon field, category ticker and the big wordmark. */
export function HeroStage() {
  const ref = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const stopPlaying = useCallback(() => setPlaying(false), []);

  function onMove(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--px", (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
    ref.current.style.setProperty("--py", (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
  }
  function onLeave() {
    ref.current?.style.setProperty("--px", "0");
    ref.current?.style.setProperty("--py", "0");
  }

  return (
    <section
      ref={ref}
      aria-label="Mapa Krakowa"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative min-h-[38vh] overflow-hidden bg-ink sm:min-h-[44vh] lg:min-h-screen"
    >
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,#12303a_0%,#0B1620_70%)]" />
      <div className="absolute inset-0 px-6 pb-16 pt-16 [container-type:size] lg:pb-44 lg:pt-20">
        <div
          className="lm-in flex size-full items-center justify-center transition-transform duration-700 ease-out will-change-transform"
          style={{ ...delayStyle(0.5), transform: "translate3d(calc(var(--px, 0) * -14px), calc(var(--py, 0) * -10px), 0)" }}
        >
          <KrakowMap />
        </div>
      </div>
      <HexField className="pointer-events-none absolute inset-0 size-full mix-blend-screen" />

      <div aria-hidden className="lm-in absolute inset-x-0 top-0 overflow-hidden border-b border-white/15 bg-ink/30 backdrop-blur-sm" style={{ "--d": "0.9s" } as React.CSSProperties}>
        <div className="lm-marquee flex w-max items-center py-2.5 font-mono text-[11px] uppercase tracking-[0.3em] text-mist/80">
          {[0, 1, 2, 3].map((copy) =>
            CATEGORIES.map((c) => (
              <span key={`${copy}-${c}`} className="flex items-center gap-3 pr-10">
                <span className={`size-1.5 rotate-45 ${CATEGORY_STYLE[c].dot}`} />
                {CATEGORY_PL[c].label}
              </span>
            )),
          )}
        </div>
      </div>

      {playing ? (
        <SnakeGame onClose={stopPlaying} />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="lm-in group absolute right-4 top-14 z-10 flex h-9 items-center gap-2 rounded-full border border-white/30 bg-ink/50 px-4 font-mono text-[11px] uppercase tracking-[0.2em] text-mist outline-none backdrop-blur transition hover:border-mint hover:text-mint focus-visible:ring-2 focus-visible:ring-mint"
          style={delayStyle(1.6)}
        >
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">▶</span>
          Zagraj
        </button>
      )}

      <Link
        href="/"
        aria-label="citylens"
        className="absolute bottom-0 left-0 z-10 px-2 pb-1 text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
      >
        <span aria-hidden className="flex font-[family-name:var(--font-roboto)] text-7xl font-bold leading-none tracking-[-0.04em] sm:text-8xl lg:text-9xl">
          {LETTERS.map((l, i) => (
            <span
              key={i}
              className="lm-mask lm-mask-logo transition-[transform,color] duration-300 ease-out hover:-translate-y-2 hover:text-mint"
            >
              <span className="lm-rise" style={{ "--d": `${0.25 + i * 0.07}s` } as React.CSSProperties}>
                {l}
              </span>
            </span>
          ))}
        </span>
      </Link>
    </section>
  );
}
