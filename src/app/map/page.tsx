import { MapExperience } from "@/components/map/map-experience";
import { importanceFromQuery } from "@/lib/scoring/preferences";

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const importance = importanceFromQuery(await searchParams);
  return (
    <main className="flex h-dvh flex-col">
      <MapExperience importance={importance} />
    </main>
  );
}
