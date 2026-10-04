"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const COUNT_MS = 1700;
const OPEN_AT = 1950; // curtains start to part
const REVEAL_AT = 2150; // page content starts rising underneath
const DONE_AT = 3300; // overlay unmounted

const HEX = "50,2 95,28 95,84 50,110 5,84 5,28";

/** One-off cinematic intro: a hexagon draws itself, a counter runs to 100, the curtains part. */
export function Intro({ onReveal, onDone }: { onReveal: () => void; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      setProgress(p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const timers = [
      setTimeout(() => setOpening(true), OPEN_AT),
      setTimeout(onReveal, REVEAL_AT),
      setTimeout(onDone, DONE_AT),
    ];
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [onReveal, onDone]);

  const half = "absolute inset-x-0 h-1/2 bg-ink transition-transform duration-[1100ms] ease-[cubic-bezier(0.76,0,0.24,1)]";

  return (
    <div aria-hidden className={cn("fixed inset-0 z-[100] text-mist", opening && "pointer-events-none")}>
      <div className={cn(half, "top-0", opening && "-translate-y-full")} />
      <div className={cn(half, "bottom-0", opening && "translate-y-full")} />

      <div className={cn("absolute inset-0 transition-all duration-500", opening && "scale-110 opacity-0 blur-md")}>
        <div className="absolute left-1/2 top-1/2 h-px -translate-x-1/2 bg-mint/70" style={{ width: `${progress * 100}%` }} />

        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-6">
          <svg viewBox="0 0 100 112" className="size-28 overflow-visible sm:size-36">
            <polygon points={HEX} pathLength={1} className="lm-draw fill-none stroke-mist" strokeWidth={1.2} strokeLinejoin="round" />
            <polygon
              points={HEX}
              pathLength={1}
              className="lm-draw fill-mint/10 stroke-mint"
              strokeWidth={1}
              strokeLinejoin="round"
              style={{ transformOrigin: "50% 50%", scale: 0.55, animationDelay: "0.5s" }}
            />
          </svg>
          <p className="font-[family-name:var(--font-roboto)] text-3xl font-bold tracking-[-0.04em] sm:text-4xl">citylens</p>
        </div>

        <p className="absolute bottom-5 left-5 font-mono text-[clamp(4rem,14vw,12rem)] font-light leading-none tabular-nums sm:bottom-8 sm:left-8">
          {String(Math.round(progress * 100)).padStart(3, "0")}
        </p>
        <p className="absolute bottom-6 right-5 text-right font-mono text-[11px] uppercase tracking-[0.25em] text-mist/60 sm:bottom-9 sm:right-8">
          Kraków
          <br />
          50.0647°N · 19.9450°E
        </p>
      </div>
    </div>
  );
}
