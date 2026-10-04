import Link from "next/link";
import { UseCaseCallouts } from "./use-case-callouts";

/** Left half: full-bleed Kraków video with rotating product examples and the wordmark. */
export function HeroStage() {
  return (
    <section
      aria-label="Mapa Krakowa"
      className="relative min-h-[38vh] overflow-hidden bg-ink sm:min-h-[44vh] lg:min-h-screen"
    >
      <video
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        className="absolute inset-0 size-full object-cover motion-reduce:hidden"
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
