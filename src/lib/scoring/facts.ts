import type { Category, HexIndicators } from "../../types";

// Turns stored OSM indicators into short, factual sentences. Deterministic; no LLM involved.

const KIND_LABELS: Record<string, string> = {
  sports_centre: "sports centre",
  stadium: "stadium",
  fitness_centre: "fitness centre",
  swimming_pool: "swimming pool",
  pitch: "sports pitch",
  museum: "museum",
  gallery: "gallery",
  theatre: "theatre",
  cinema: "cinema",
  arts_centre: "arts centre",
  library: "library",
  community_centre: "community centre",
  attraction: "tourist attraction",
  viewpoint: "viewpoint",
  music_venue: "music venue",
  concert_hall: "concert hall",
  nightclub: "nightclub",
  historic_castle: "castle",
  historic_monument: "monument",
  historic_manor: "manor",
  historic_fort: "fort",
  mall: "shopping mall",
  department_store: "department store",
  supermarket: "supermarket",
  rail_station: "railway station",
  tram_stop: "tram stop",
  bus_stop: "bus stop",
};

const NOUNS: Record<Exclude<Category, "greenery">, [singular: string, plural: string]> = {
  sport: ["sports facility", "sports facilities"],
  culture: ["cultural venue", "cultural venues"],
  shopping: ["shop", "shops"],
  transport: ["stop or station", "stops and stations"],
};

const metres = (m: number) => (m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

// Seeds computed before these were excluded from scoring may still list them as "nearest".
const IGNORED_KINDS = new Set(["vacant", "disused", "closed", "no"]);

function describeNearest(n: { name: string | null; kind: string; distanceM: number }): string {
  const what = n.name ? `${n.name} (${kindLabel(n.kind)})` : `a ${kindLabel(n.kind)}`;
  return `${what}, ${metres(n.distanceM)} away`;
}

/** One-line, data-backed description of a category in this cell. */
export function describeCategory(category: Category, ind: HexIndicators): string {
  if (category === "greenery") {
    const g = ind.greenery;
    const cover = Math.round(g.coverShare * 100);
    const park = g.nearestPark
      ? `${g.nearestPark.name ?? "A green area"} (${g.nearestPark.areaHa} ha), ${g.nearestPark.distanceM === 0 ? "you are inside it" : `${metres(g.nearestPark.distanceM)} away`}`
      : "no large park within 1 km";
    return `${park}; ~${cover}% green cover within 500 m`;
  }
  const i = ind[category];
  const [one, many] = NOUNS[category];
  if (!i.nearest) return `no ${many} within ${(i.radiusM ?? 1000) / 1000} km`;
  const count =
    i.within500 > 0
      ? `${i.within500} ${i.within500 === 1 ? one : many} within 500 m`
      : i.within1000 > 0
        ? `none within 500 m`
        : `none within 1 km`;
  if (IGNORED_KINDS.has(i.nearest.kind)) return count;
  return `${count}; nearest: ${describeNearest(i.nearest)}`;
}

export function describeAll(ind: HexIndicators): Record<Category, string> {
  return {
    sport: describeCategory("sport", ind),
    culture: describeCategory("culture", ind),
    greenery: describeCategory("greenery", ind),
    shopping: describeCategory("shopping", ind),
    transport: describeCategory("transport", ind),
  };
}
