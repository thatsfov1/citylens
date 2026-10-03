import { MapExperience } from "@/components/map/map-experience";
import { loadHexes } from "@/lib/supabase/hex-scores";
import { importanceFromQuery, minSafetyFromQuery } from "@/lib/scoring/preferences";

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const params = await searchParams;
  const importance = importanceFromQuery(params);
  const { hexes, source } = await loadHexes();
  return (
    <main className="flex h-dvh flex-col">
      <MapExperience hexes={hexes} source={source} importance={importance} initialMinSafety={minSafetyFromQuery(params)} />
    </main>
  );
}
