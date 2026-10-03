import { MapExperience } from "@/components/map/map-experience";
import { loadHexes } from "@/lib/supabase/hex-scores";
import { importanceFromQuery, minSafetyFromQuery } from "@/lib/scoring/preferences";
import { anchorFromQuery } from "@/lib/scoring/anchor";
import { workplaceFromQuery } from "@/lib/scoring/commute";
import { rentFromQuery } from "@/lib/scoring/rent";
import { parseStages } from "@/lib/scoring/education";
import { parseShareState, rentPhrase, topPreferences } from "@/lib/share/state";
import type { Metadata } from "next";

/** A shared link previews as the preferences it carries, e.g. "zieleń 100%, transport 75% · czynsz do 3 500 zł". */
export async function generateMetadata({ searchParams }: PageProps<"/map">): Promise<Metadata> {
  const params = await searchParams;
  const parts = [topPreferences(importanceFromQuery(params)).join(", "), rentPhrase(rentFromQuery(params))].filter(Boolean);
  return {
    title: "Kraków dopasowany do Ciebie",
    description: parts.length ? `Mapa dopasowania: ${parts.join(" · ")}` : undefined,
  };
}

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const params = await searchParams;
  const importance = importanceFromQuery(params);
  const { hexes, source } = await loadHexes();
  const share = parseShareState(params, new Set(hexes.map((h) => h.h3Index)));
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
        initialShare={share}
        initialStages={parseStages(typeof params.edu === "string" ? params.edu : null)}
      />
    </main>
  );
}
