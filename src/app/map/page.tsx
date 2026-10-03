import { MapExperience } from "@/components/map/map-experience";
import { loadHexData } from "@/lib/supabase/hex-scores";
import { importanceFromQuery } from "@/lib/scoring/preferences";

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const importance = importanceFromQuery(await searchParams);
  const hexes = await loadHexData();
  return (
    <main className="flex h-dvh flex-col">
      <MapExperience hexes={hexes} importance={importance} />
    </main>
  );
}
