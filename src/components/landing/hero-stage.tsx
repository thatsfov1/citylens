import Link from "next/link";
import { KrakowMap } from "./krakow-shape";
import { UseCaseCallouts } from "./use-case-callouts";

/** Left half: the city video inside Kraków's outline, with rotating product examples and the wordmark. */
export function HeroStage() {
  return (
    <section
      aria-label="Mapa Krakowa"
      className="relative min-h-[38vh] overflow-hidden bg-ink bg-[radial-gradient(ellipse_at_50%_40%,#12303a_0%,#0B1620_70%)] sm:min-h-[44vh] lg:min-h-screen"
    >
      <div className="absolute inset-0 px-6 pb-16 pt-10 [container-type:size] lg:pb-44 lg:pt-16">
        <div className="flex size-full items-center justify-center">
          <KrakowMap />
        </div>
      </div>
      <UseCaseCallouts />
      <Link
        href="/"
        aria-label="Citylens — strona główna"
        className="absolute bottom-5 left-5 z-20 flex items-center gap-2 text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:bottom-7 sm:left-7"
      >
        <span aria-hidden="true" className="relative size-6 rounded-full border-2 border-current sm:size-7">
          <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
        </span>
        <span className="font-[family-name:var(--font-bricolage)] text-4xl font-semibold leading-none tracking-[-0.06em] sm:text-5xl lg:text-6xl">
          citylens.
        </span>
      </Link>
    </section>
  );
}
