import { importanceFromQuery } from "@/lib/scoring/preferences";
import { PreferencesForm } from "@/components/preferences/preferences-form";

export default async function Home({ searchParams }: PageProps<"/">) {
  const initial = importanceFromQuery(await searchParams);
  return (
    <main className="relative flex flex-1 items-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <HexBackdrop />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-16">
        <section>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Kraków · personalized suitability map
          </p>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Find where the city{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">
              fits you.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
            There is no “best neighborhood”. Tell us what you care about and
            we’ll show which parts of Kraków match your lifestyle — and why.
          </p>
        </section>
        <PreferencesForm initial={initial} />
      </div>
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
