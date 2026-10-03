import { dec } from "../format/pl";
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
  sports_centre: "Centrum sportowe",
  stadium: "Stadion",
  fitness_centre: "Siłownia",
  swimming_pool: "Basen",
  pitch: "Boisko",
  museum: "Muzeum",
  gallery: "Galeria",
  attraction: "Atrakcja turystyczna",
  viewpoint: "Punkt widokowy",
  theatre: "Teatr",
  cinema: "Kino",
  arts_centre: "Centrum sztuki",
  library: "Biblioteka",
  community_centre: "Dom kultury",
  nightclub: "Klub nocny",
  music_venue: "Klub muzyczny",
  concert_hall: "Sala koncertowa",
  historic_castle: "Zamek",
  historic_monument: "Pomnik",
  historic_manor: "Dwór",
  historic_fort: "Fort",
  mall: "Centrum handlowe",
  department_store: "Dom towarowy",
  supermarket: "Supermarket",
  convenience: "Sklep osiedlowy",
  rail_station: "Stacja kolejowa",
  tram_stop: "Przystanek tramwajowy",
  bus_stop: "Przystanek autobusowy",
  kindergarten: "Przedszkole",
  childcare: "Żłobek",
  primary_school: "Szkoła podstawowa",
  secondary_school: "Szkoła średnia",
  school: "Szkoła",
  university: "Uniwersytet",
  college: "Uczelnia",
};

export function kindLabel(kind: string): string {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind];
  const k = kind.replace(/^historic_/, "").replace(/_/g, " ");
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export const placeTitle = (p: Place) => p.name ?? kindLabel(p.kind);

export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${dec(m / 1000)} km`);

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
