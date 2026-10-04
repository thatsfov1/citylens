"use client";

import { useEffect, useRef } from "react";
import { CATEGORIES } from "@/types";
import { CATEGORY_PL, CATEGORY_STYLE } from "./landing-copy";
import { Reveal } from "./reveal";
import { TiltCard } from "./tilt-card";

const EMOJI = { sport: "🏃", culture: "🎭", greenery: "🌳", shopping: "🛍️", transport: "🚋", education: "🎓" } as const;
const GLOW = { sport: "#FFB547", culture: "#F58FB2", greenery: "#5FE3A1", shopping: "#7CC4FF", transport: "#B9A2FF", education: "#FF8A6B" } as const;

const STEPS = [
  { n: "01", title: "Opisz", text: "Napisz własnymi słowami, jak chcesz mieszkać. Asystent zamieni to na ważność sześciu kategorii." },
  { n: "02", title: "Dopasuj", text: "Każdy heksagon w Krakowie dostaje wynik z danych — OpenStreetMap, przystanki, jakość powietrza. Bez zgadywania." },
  { n: "03", title: "Odkryj", text: "Mapa podświetla miejsca, które pasują do Ciebie. Kliknij, żeby zobaczyć dlaczego." },
];

/** Giant outlined text that slides sideways as the page scrolls. */
function ScrollMarquee({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = (window.innerHeight - r.top) / (window.innerHeight + r.height); // 0..1 while on screen
      el.style.transform = `translate3d(${(-p * 40).toFixed(2)}%, 0, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div aria-hidden className="overflow-hidden py-10">
      <div ref={ref} className="flex w-max gap-12 whitespace-nowrap will-change-transform">
        {[0, 1, 2].map((i) => (
          <span key={i} className="lm-outline font-[family-name:var(--font-roboto)] text-[clamp(5rem,16vw,14rem)] font-bold leading-none tracking-[-0.05em]">
            {text} ◆
          </span>
        ))}
      </div>
    </div>
  );
}

/** Below-the-fold story: how it works, the six categories, and a scroll-scrubbed closing line. */
export function ScrollSections() {
  return (
    <div className="relative z-10 bg-ink text-mist">
      <ScrollMarquee text="Znajdź swoje miejsce" />

      <section aria-labelledby="how" className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8">
        <Reveal as="p" className="font-mono text-[11px] uppercase tracking-[0.3em] text-mint">
          Jak to działa
        </Reveal>
        <Reveal as="h2" delay={0.1} className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
          <span id="how">Trzy kroki od opisu do mapy.</span>
        </Reveal>
        <ol className="mt-14 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} delay={0.1 + i * 0.12} className="group relative bg-ink p-8 transition-colors duration-500 hover:bg-white/[0.04]">
              <span className="font-mono text-6xl font-light text-white/15 transition-colors duration-500 group-hover:text-mint sm:text-7xl">{s.n}</span>
              <h3 className="mt-6 text-2xl font-semibold">{s.title}</h3>
              <p className="mt-3 text-sm font-light leading-relaxed text-mist/70">{s.text}</p>
              <span aria-hidden className="absolute bottom-0 left-0 h-0.5 w-0 bg-mint transition-all duration-700 group-hover:w-full" />
            </Reveal>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cats" className="mx-auto max-w-[1200px] px-5 pb-24 sm:px-8">
        <Reveal as="p" className="font-mono text-[11px] uppercase tracking-[0.3em] text-sun">
          Sześć kategorii
        </Reveal>
        <Reveal as="h2" delay={0.1} className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
          <span id="cats">Każda okolica ma inny charakter.</span>
        </Reveal>
        <ul className="mt-14 grid gap-4 [perspective:1000px] sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c, i) => (
            <Reveal as="li" key={c} delay={i * 0.08}>
              <TiltCard glow={GLOW[c]} className="h-full rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                <span className={`flex size-14 items-center justify-center rounded-full border-2 text-3xl ${CATEGORY_STYLE[c].tile}`}>
                  <span aria-hidden>{EMOJI[c]}</span>
                </span>
                <h3 className="mt-6 text-xl font-semibold">{CATEGORY_PL[c].label}</h3>
                <p className="mt-2 text-sm font-light leading-relaxed text-mist/70">{CATEGORY_PL[c].hint}</p>
              </TiltCard>
            </Reveal>
          ))}
        </ul>
      </section>

      <div className="flex flex-col items-center gap-6 border-t border-white/10 px-5 py-20 text-center">
        <Reveal as="h2" className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-5xl">
          Gotowy zobaczyć, gdzie <span className="font-display italic text-mint">pasujesz</span>?
        </Reveal>
        <Reveal delay={0.15}>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group flex h-12 items-center gap-3 border border-white/30 px-6 text-sm transition-colors hover:border-mint hover:bg-mint hover:text-ink"
          >
            Wróć na górę i opisz swoje preferencje
            <span aria-hidden className="transition-transform duration-300 group-hover:-translate-y-1">↑</span>
          </button>
        </Reveal>
      </div>
    </div>
  );
}
