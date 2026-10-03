import { MapExperience } from "@/components/map/map-experience";
import { loadHexes } from "@/lib/supabase/hex-scores";
import { importanceFromQuery } from "@/lib/scoring/preferences";

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const importance = importanceFromQuery(await searchParams);
  const { hexes, source } = await loadHexes();
  return (
    <main className="flex h-dvh flex-col">
      <MapExperience hexes={hexes} source={source} importance={importance} />
    </main>
  );
}
