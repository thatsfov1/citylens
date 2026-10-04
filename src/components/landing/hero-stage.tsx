import Link from "next/link";
import { KrakowMap } from "./krakow-shape";

/** Left half: the city video inside Kraków's outline, with the wordmark. Static — no decorative motion. */
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
      <Link
        href="/"
        className="absolute bottom-0 left-0 z-10 px-2 pb-1 text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
      >
        <span className="block font-[family-name:var(--font-roboto)] text-7xl font-bold leading-none tracking-[-0.04em] sm:text-8xl lg:text-9xl">
          citylens
        </span>
      </Link>
    </section>
  );
}
