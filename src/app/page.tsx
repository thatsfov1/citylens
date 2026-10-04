import { CATEGORIES } from "@/types";
import { importanceFromQuery } from "@/lib/scoring/preferences";
import { anchorFromQuery } from "@/lib/scoring/anchor";
import { workplaceFromQuery } from "@/lib/scoring/commute";
import { rentFromQuery } from "@/lib/scoring/rent";
import { parseStages } from "@/lib/scoring/education";
import { Landing } from "@/components/landing/landing";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  // Coming back from the map: prefill the preferences and filters from the URL. A fresh visit starts with none.
  const hasPreferences = CATEGORIES.some((c) => typeof params[c] === "string");
  if (!hasPreferences) return <Landing />;
  const edu = typeof params.edu === "string" ? params.edu : null;
  const minSafety = typeof params.minSafety === "string" ? params.minSafety : null;
  return (
    <Landing
      initial={importanceFromQuery(params)}
      initialFilters={{
        stages: edu ? parseStages(edu) : null,
        anchor: anchorFromQuery(params.near),
        rent: rentFromQuery(params),
        workplace: workplaceFromQuery(params.work),
        car: params.car === "1",
        minSafety,
      }}
    />
  );
}
