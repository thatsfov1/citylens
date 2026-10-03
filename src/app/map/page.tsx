import { MapExperience } from "@/components/map/map-experience";
import { loadHexes } from "@/lib/supabase/hex-scores";
import { avoidFromQuery, importanceFromQuery, minSafetyFromQuery } from "@/lib/scoring/preferences";
import { anchorFromQuery } from "@/lib/scoring/anchor";
import { parseStages } from "@/lib/scoring/education";

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const params = await searchParams;
  const importance = importanceFromQuery(params);
  const { hexes, source } = await loadHexes();
  return (
    <main className="flex h-dvh flex-col">
      <MapExperience
        hexes={hexes}
        source={source}
        importance={importance}
        initialMinSafety={minSafetyFromQuery(params)}
        initialAvoid={avoidFromQuery(params.avoid)}
        anchor={anchorFromQuery(params.near)}
        initialStages={parseStages(typeof params.edu === "string" ? params.edu : null)}
      />
    </main>
  );
}
