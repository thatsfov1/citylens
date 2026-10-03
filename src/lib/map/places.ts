import type { Category, Place, PlaceCategory } from "@/types";

export const PLACE_COLORS: Record<PlaceCategory, string> = {
  sport: "#2563eb",
  culture: "#9333ea",
  shopping: "#ea580c",
  transport: "#0891b2",
  education: "#e11d48",
};
export const GREEN_COLOR = "#16a34a";

const KIND_LABELS: Record<string, string> = {
  sports_centre: "Sports centre",
  stadium: "Stadium",
  fitness_centre: "Gym",
  swimming_pool: "Swimming pool",
  pitch: "Sports pitch",
  museum: "Museum",
  gallery: "Gallery",
  attraction: "Attraction",
  viewpoint: "Viewpoint",
  theatre: "Theatre",
  cinema: "Cinema",
  arts_centre: "Arts centre",
  library: "Library",
  community_centre: "Community centre",
  nightclub: "Nightclub",
  music_venue: "Music venue",
  concert_hall: "Concert hall",
  mall: "Shopping mall",
  department_store: "Department store",
  supermarket: "Supermarket",
  convenience: "Convenience store",
  rail_station: "Rail station",
  tram_stop: "Tram stop",
  bus_stop: "Bus stop",
  kindergarten: "Kindergarten",
  childcare: "Nursery",
  primary_school: "Primary school",
  secondary_school: "Secondary school",
  school: "School",
  university: "University",
  college: "College",
};

export function kindLabel(kind: string): string {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  const k = kind.replace(/^historic_/, "").replace(/_/g, " ");
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export const placeTitle = (p: Place) => p.name ?? kindLabel(p.kind);

export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

/** Categories whose places are pinned by default: the active mode, or the user's top-weighted for "For You". */
export function defaultPinCategories(mode: Category | "forYou", weights: Record<Category, number>): Set<Category> {
  if (mode !== "forYou") return new Set([mode]);
  const top = (Object.keys(weights) as Category[]).sort((a, b) => weights[b] - weights[a]).slice(0, 2);
  return new Set(top);
}

/** Circle polygon ring ([lng, lat]) of `radiusM` around a point, for the distance guide. */
export function circleRing([lng, lat]: [number, number], radiusM: number, steps = 64): [number, number][] {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + (Math.cos(a) * radiusM) / kx, lat + (Math.sin(a) * radiusM) / 110574]);
  }
  return ring;
}
