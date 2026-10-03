import { MapExperience } from "@/components/map/map-experience";
import { loadHexes } from "@/lib/supabase/hex-scores";
import { importanceFromQuery, minSafetyFromQuery } from "@/lib/scoring/preferences";
import { anchorFromQuery } from "@/lib/scoring/anchor";
import { workplaceFromQuery } from "@/lib/scoring/commute";
import { rentFromQuery } from "@/lib/scoring/rent";
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
        anchor={anchorFromQuery(params.near)}
        initialRent={rentFromQuery(params)}
        workplace={workplaceFromQuery(params.work)}
        initialStages={parseStages(typeof params.edu === "string" ? params.edu : null)}
      />
    </main>
  );
}
