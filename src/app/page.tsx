import { CATEGORIES } from "@/types";
import { importanceFromQuery } from "@/lib/scoring/preferences";
import { Landing } from "@/components/landing/landing";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  // Coming back from the map: prefill the chips from the URL. A fresh visit starts with none.
  const hasPreferences = CATEGORIES.some((c) => typeof params[c] === "string");
  return <Landing initial={hasPreferences ? importanceFromQuery(params) : undefined} />;
}
