import { importanceFromQuery } from "@/lib/scoring/preferences";
import { PreferencesForm } from "@/components/preferences/preferences-form";
import { OsmAttribution } from "@/components/osm-attribution";
import { LandingMapPreview } from "@/components/map/landing-map-preview";

export default async function Home({ searchParams }: PageProps<"/">) {
  const initial = importanceFromQuery(await searchParams);
  return (
    <main className="relative flex flex-1 items-center overflow-x-clip bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <HexBackdrop />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-7 px-4 py-6 sm:px-6 sm:py-9 lg:grid-cols-[1fr_0.9fr] lg:gap-12 lg:px-8 lg:py-10">
        <section className="flex flex-col items-start">
          <p className="mb-4 inline-flex items-center gap-2 border border-emerald-200 bg-white/75 px-3 py-1.5 text-xs font-normal tracking-wide text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            YOUR CITY, YOUR PRIORITIES
          </p>
          <h1 className="max-w-2xl text-5xl font-light leading-[0.98] tracking-[-0.055em] text-balance sm:text-6xl lg:text-7xl">
            Find your kind of <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">Kraków.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base font-light leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Explore the city through what matters to you — from parks and sport to culture, shops, and public transport.
          </p>
          <LandingMapPreview />
          <p className="mt-3 flex items-center gap-2 text-xs font-normal text-slate-500">
            <span className="size-1.5 rounded-full bg-emerald-500" /> No account needed <span className="text-slate-300">·</span> Change your priorities anytime
          </p>
        </section>
        <PreferencesForm initial={initial} />
      </div>
      <OsmAttribution className="absolute inset-x-0 bottom-2 text-center" />
    </main>
  );
}

function HexBackdrop() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full text-emerald-700/[0.07]"
    >
      <defs>
        <pattern
          id="hex"
          width="56"
          height="97"
          patternUnits="userSpaceOnUse"
          patternTransform="scale(1.2)"
        >
          <path
            d="M28 66 L0 50 L0 16 L28 0 L56 16 L56 50 Z M28 100 L28 66 M0 50 L-28 66 M56 50 L84 66"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  );
}
