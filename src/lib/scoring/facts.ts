import type { Category, HexIndicators } from "../../types";
import { airLevel } from "../data/air";
import { CCTV_RADIUS_M, EMERGENCY_REACH_M, LIGHTING_RADIUS_M, NIGHTLIFE_RADIUS_M, partShares, type SafetyPart } from "../data/safety";

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

function describeNearest(n: { name: string | null; kind: string; distanceM: number; departuresPerHour?: number }): string {
  const service = n.departuresPerHour !== undefined ? `, ~${perHour(n.departuresPerHour)} departures/h` : "";
  const what = n.name ? `${n.name} (${kindLabel(n.kind)}${service})` : `a ${kindLabel(n.kind)}${service}`;
  return `${what}, ${metres(n.distanceM)} away`;
}

const perHour = (d: number) => (d >= 10 ? Math.round(d) : Math.round(d * 10) / 10);

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
  // GTFS-backed transport also reports how often those stops are served.
  const service =
    i.departuresPerHourWithin500 !== undefined ? ` (~${perHour(i.departuresPerHourWithin500)} departures/h on weekdays)` : "";
  const count =
    i.within500 > 0
      ? `${i.within500} ${i.within500 === 1 ? one : many} within 500 m${service}`
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

export type SafetyPartInfo = {
  key: SafetyPart;
  label: string;
  /** How this indicator is measured and why it matters, in plain words. */
  how: string;
  /** The real numbers for this area. */
  fact: string;
  /** 0–100, relative to other built-up areas of Kraków. */
  score: number | null;
  /** Share (%) of the combined safety level this indicator accounts for. */
  sharePct: number | null;
};

/**
 * Safety explained indicator by indicator: what is measured, the numbers for this area, the indicator's own score
 * and how much it counts. Deterministic and sourced — nothing here is generated. Empty when there is no data.
 */
export function describeSafetyParts(ind: HexIndicators): SafetyPartInfo[] {
  const { crime, lighting, cctv, emergency } = ind.safety ?? {};
  const parts = ind.safety?.parts ?? {};
  const shares = partShares(parts);
  const info = (key: SafetyPart, label: string, how: string, fact: string): SafetyPartInfo => ({
    key,
    label,
    how,
    fact,
    score: parts[key] ?? null,
    sharePct: shares[key] !== undefined ? Math.round((shares[key] as number) * 100) : null,
  });
  const out: SafetyPartInfo[] = [];
  if (crime) {
    out.push(
      info(
        "crime",
        "Reported crime",
        "Crimes reported by the police in this police area, per 1,000 residents, compared with the other areas. Fewer is better.",
        `${crime.per1000} reported crimes per 1,000 residents in police area ${crime.area} (${crime.year}); city: ${crime.cityPer1000}`,
      ),
    );
  }
  if (lighting) {
    out.push(
      info(
        "lighting",
        "Street lighting at night",
        `Of the streets and paths within ${metres(LIGHTING_RADIUS_M)} that OpenStreetMap mappers tagged as lit or unlit, the share that is lit. Well-lit streets feel safer after dark. Compared with the other areas of Kraków.`,
        `${lighting.lit} of ${lighting.segments} tagged street segments are lit (mappers rarely tag “unlit”, so this leans optimistic)`,
      ),
    );
  }
  if (cctv) {
    out.push(
      info(
        "cctv",
        "Cameras (CCTV)",
        `Surveillance cameras mapped in OpenStreetMap within ${metres(CCTV_RADIUS_M)}. More cameras means more of the area is watched. Compared with the other areas.`,
        `${cctv.cameras} mapped ${cctv.cameras === 1 ? "camera" : "cameras"} within ${metres(CCTV_RADIUS_M)}`,
      ),
    );
  }
  if (emergency) {
    const near = (label: string, d: number | null) => (d === null ? null : `${label} ${metres(d)}`);
    const list = [near("police", emergency.police), near("fire station", emergency.fire), near("hospital or clinic", emergency.hospital)].filter(Boolean);
    out.push(
      info(
        "emergency",
        "Help nearby",
        `Distance to the nearest police station (counts 40%), fire station (30%) and hospital or clinic (30%), up to ${metres(EMERGENCY_REACH_M)}. Closer help scores higher. Compared with the other areas.`,
        list.length > 0 ? `Nearest: ${list.join(", ")}` : `No police, fire station or hospital within ${metres(EMERGENCY_REACH_M)}`,
      ),
    );
  }
  return out;
}

/** Air-quality facts for the panel: the interpolated values, where they come from and how recent they are. */
export function describeAir(ind: HexIndicators): string[] {
  const a = ind.air;
  if (!a) return [];
  const out: string[] = [];
  if (a.pm10 !== undefined) out.push(`PM10 about ${a.pm10} µg/m³`);
  if (a.pm25 !== undefined) out.push(`PM2.5 about ${a.pm25} µg/m³`);
  out.push(
    `Interpolated from ${a.stations} ${a.stations === 1 ? "station" : "stations"}; the nearest, ${a.nearest.name}, is ${metres(a.nearest.distanceM)} away`,
  );
  return out;
}

/** One-line, plain-language reading of the air for a quick look; null when the area has no air data. */
export function describeAirLevel(ind: HexIndicators): string | null {
  if (!ind.air) return null;
  return `Usually ${airLevel(ind.air)} here: handy for a quick eyeball, not a precise reading.`;
}

/** What the air-quality figure can and cannot tell you. Shown in the panel. */
export const AIR_CAVEAT =
  "A recent snapshot (mean of the last few days of hourly readings), not an annual average, and an estimate between a handful of official stations rather than a measurement at this spot. Air changes a lot with season and weather. Source: GIOŚ.";

/** Night-time context shown next to the safety level. Informational: not part of the score. */
export function describeNightlife(ind: HexIndicators): string | null {
  const n = ind.safety?.nightlife;
  if (!n) return null;
  return n.venues > 0
    ? `${n.venues} ${n.venues === 1 ? "bar, pub or club" : "bars, pubs and clubs"} within ${metres(NIGHTLIFE_RADIUS_M)}`
    : `No bars, pubs or clubs within ${metres(NIGHTLIFE_RADIUS_M)}`;
}

/** What the safety level can and cannot tell you. Shown in the panel. */
export const SAFETY_NOT_INCLUDED =
  "Not included: crime and incident statistics (the police publish them only as press figures, not as open data), road accidents, and citizen reports (no public export). The level describes the surroundings, not what happened there, and it is not a verdict on an area.";

/** Short facts for tests and plain-text uses: the fact line of every indicator. */
export function describeSafety(ind: HexIndicators): string[] {
  return describeSafetyParts(ind).map((p) => p.fact);
}
