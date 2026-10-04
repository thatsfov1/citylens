import { EDUCATION_STAGES, type Category, type EducationStage, type HexIndicators } from "../../types";
import { dec, plCount } from "../format/pl";
import { airLevel } from "../data/air";
import { HEALTH_KINDS, HEALTH_SCALE, HEALTH_WEIGHTS, type HealthKind } from "../data/health";
import { CCTV_RADIUS_M, EMERGENCY_REACH_M, LIGHTING_RADIUS_M, NIGHTLIFE_RADIUS_M, partShares, type SafetyPart } from "../data/safety";

// Turns stored OSM indicators into short, factual sentences. Deterministic; no LLM involved.

const KIND_LABELS: Record<string, string> = {
  sports_centre: "centrum sportowe",
  stadium: "stadion",
  fitness_centre: "siłownia",
  swimming_pool: "basen",
  pitch: "boisko",
  museum: "muzeum",
  gallery: "galeria",
  theatre: "teatr",
  cinema: "kino",
  arts_centre: "centrum sztuki",
  library: "biblioteka",
  community_centre: "dom kultury",
  attraction: "atrakcja turystyczna",
  viewpoint: "punkt widokowy",
  music_venue: "klub muzyczny",
  concert_hall: "sala koncertowa",
  nightclub: "klub nocny",
  historic_castle: "zamek",
  historic_monument: "pomnik",
  historic_manor: "dwór",
  historic_fort: "fort",
  mall: "centrum handlowe",
  department_store: "dom towarowy",
  supermarket: "supermarket",
  convenience: "sklep osiedlowy",
  rail_station: "stacja kolejowa",
  tram_stop: "przystanek tramwajowy",
  bus_stop: "przystanek autobusowy",
  kindergarten: "przedszkole",
  childcare: "żłobek",
  primary_school: "szkoła podstawowa",
  secondary_school: "szkoła średnia",
  school: "szkoła",
  university: "uniwersytet",
  college: "uczelnia",
};

/** [one, few, many]: "1 sklep", "2 sklepy", "5 sklepów" (many doubles as the genitive plural: "brak sklepów"). */
type Noun = [one: string, few: string, many: string];

const NOUNS: Record<Exclude<Category, "greenery" | "education">, Noun> = {
  sport: ["obiekt sportowy", "obiekty sportowe", "obiektów sportowych"],
  culture: ["miejsce kultury", "miejsca kultury", "miejsc kultury"],
  shopping: ["sklep", "sklepy", "sklepów"],
  transport: ["przystanek lub stacja", "przystanki lub stacje", "przystanków lub stacji"],
};

const metres = (m: number) => (m >= 950 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m / 10) * 10} m`);

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ");
}

// Seeds computed before these were excluded from scoring may still list them as "nearest".
const IGNORED_KINDS = new Set(["vacant", "disused", "closed", "no"]);

function describeNearest(n: { name: string | null; kind: string; distanceM: number; departuresPerHour?: number }): string {
  const service = n.departuresPerHour !== undefined ? `, ~${perHour(n.departuresPerHour)} odjazdów/godz.` : "";
  const what = n.name ? `${n.name} (${kindLabel(n.kind)}${service})` : `${kindLabel(n.kind)}${service}`;
  return `${what}, ${metres(n.distanceM)} stąd`;
}

const perHour = (d: number) => (d >= 10 ? Math.round(d) : Math.round(d * 10) / 10);

/** One-line, data-backed description of a category in this cell. */
export function describeCategory(category: Category, ind: HexIndicators): string {
  if (category === "greenery") {
    const g = ind.greenery;
    const cover = Math.round(g.coverShare * 100);
    const park = g.nearestPark
      ? `${g.nearestPark.name ?? "Teren zielony"} (${String(g.nearestPark.areaHa).replace(".", ",")} ha), ${g.nearestPark.distanceM === 0 ? "jesteś w jego granicach" : `${metres(g.nearestPark.distanceM)} stąd`}`
      : "brak dużego parku w promieniu 1 km";
    return `${park}; ~${cover}% terenów zielonych w promieniu 500 m`;
  }
  if (category === "education") return describeEducation(ind);
  const i = ind[category];
  const noun = NOUNS[category];
  if (!i.nearest) return `brak: ${noun[2]} w promieniu ${(i.radiusM ?? 1000) / 1000} km`;
  // GTFS-backed transport also reports how often those stops are served.
  const service =
    i.departuresPerHourWithin500 !== undefined ? ` (~${perHour(i.departuresPerHourWithin500)} odjazdów/godz. w dni robocze)` : "";
  const count =
    i.within500 > 0
      ? `${plCount(i.within500, ...noun)} w promieniu 500 m${service}`
      : i.within1000 > 0
        ? `brak w promieniu 500 m`
        : `brak w promieniu 1 km`;
  if (IGNORED_KINDS.has(i.nearest.kind)) return count;
  return `${count}; najbliżej: ${describeNearest(i.nearest)}`;
}

/** Plain-words limits of the education score, shown next to it. */
export const EDUCATION_CAVEAT =
  "Liczy pobliskie szkoły i przedszkola (OpenStreetMap). Nic nie mówi o jakości, wolnych miejscach ani o tym, do której szkoły przypisany jest Twój adres.";

const STAGE_NOUNS: Record<EducationStage, Noun> = {
  kindergarten: ["przedszkole lub żłobek", "przedszkola lub żłobki", "przedszkoli lub żłobków"],
  primary: ["szkoła podstawowa", "szkoły podstawowe", "szkół podstawowych"],
  secondary: ["szkoła średnia", "szkoły średnie", "szkół średnich"],
  university: ["uczelnia", "uczelnie", "uczelni"],
};

/**
 * Education access for the selected life stages, one clause per stage ("2 szkoły podstawowe w promieniu 1 km; najbliżej: …").
 * Counts come from the stored per-stage indicators; nothing is generated.
 */
export function describeEducation(ind: HexIndicators, stages: readonly EducationStage[] = EDUCATION_STAGES): string {
  const edu = ind.education;
  if (!edu) return "brak jeszcze danych o edukacji dla tego obszaru";
  const parts = EDUCATION_STAGES.filter((s) => stages.includes(s)).map((s) => {
    const i = edu.stages[s];
    const noun = STAGE_NOUNS[s];
    if (!i.nearest) return `brak: ${noun[2]} w promieniu ${(i.radiusM ?? 1000) / 1000} km`;
    const n = i.within1000;
    const near = describeNearest(i.nearest);
    return n > 0 ? `${plCount(n, ...noun)} w promieniu 1 km; najbliżej: ${near}` : `${noun[0]}: brak w promieniu 1 km; najbliżej: ${near}`;
  });
  return parts.join(" · ");
}

export function describeAll(ind: HexIndicators, stages?: readonly EducationStage[]): Record<Category, string> {
  return {
    education: describeEducation(ind, stages),
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
        "Zgłoszone przestępstwa",
        "Przestępstwa zgłoszone policji w tym rejonie, na 1000 mieszkańców, w porównaniu z innymi obszarami. Im mniej, tym lepiej.",
        `${dec(crime.per1000)} zgłoszonych przestępstw na 1000 mieszkańców w rejonie policji ${crime.area} (${crime.year}); średnia dla miasta: ${dec(crime.cityPer1000)}`,
      ),
    );
  }
  if (lighting) {
    out.push(
      info(
        "lighting",
        "Oświetlenie ulic nocą",
        `Spośród ulic i ścieżek w promieniu ${metres(LIGHTING_RADIUS_M)}, które autorzy map w OpenStreetMap oznaczyli jako oświetlone lub nieoświetlone, odsetek oświetlonych. Dobrze oświetlone ulice dają większe poczucie bezpieczeństwa po zmroku. W porównaniu z innymi obszarami Krakowa.`,
        `${lighting.lit} z ${lighting.segments} oznaczonych odcinków ulic jest oświetlonych (rzadko oznacza się „nieoświetlone”, więc wynik jest raczej optymistyczny)`,
      ),
    );
  }
  if (cctv) {
    out.push(
      info(
        "cctv",
        "Kamery (monitoring)",
        `Kamery monitoringu zmapowane w OpenStreetMap w promieniu ${metres(CCTV_RADIUS_M)}. Więcej kamer oznacza, że większa część obszaru jest obserwowana. W porównaniu z innymi obszarami.`,
        `${plCount(cctv.cameras, "zmapowana kamera", "zmapowane kamery", "zmapowanych kamer")} w promieniu ${metres(CCTV_RADIUS_M)}`,
      ),
    );
  }
  if (emergency) {
    const near = (label: string, d: number | null) => (d === null ? null : `${label} ${metres(d)}`);
    const list = [near("policja", emergency.police), near("straż pożarna", emergency.fire), near("szpital lub przychodnia", emergency.hospital)].filter(Boolean);
    out.push(
      info(
        "emergency",
        "Pomoc w pobliżu",
        `Odległość do najbliższego komisariatu policji (liczy się w 40%), jednostki straży pożarnej (30%) i szpitala lub przychodni (30%), do ${metres(EMERGENCY_REACH_M)}. Im bliżej pomoc, tym wyższy wynik. W porównaniu z innymi obszarami.`,
        list.length > 0 ? `Najbliżej: ${list.join(", ")}` : `Brak policji, straży pożarnej i szpitala w promieniu ${metres(EMERGENCY_REACH_M)}`,
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
  if (a.pm10 !== undefined) out.push(`PM10 ok. ${a.pm10} µg/m³`);
  if (a.pm25 !== undefined) out.push(`PM2.5 ok. ${a.pm25} µg/m³`);
  out.push(
    `Interpolowane z danych ${a.stations} stacji; najbliższa, ${a.nearest.name}, jest ${metres(a.nearest.distanceM)} stąd`,
  );
  return out;
}

const AIR_LEVEL_PL = { good: "dobra", normal: "umiarkowana", bad: "zła", "very bad": "bardzo zła" } as const;

/** One-line, plain-language reading of the air for a quick look; null when the area has no air data. */
export function describeAirLevel(ind: HexIndicators): string | null {
  if (!ind.air) return null;
  return `Jakość powietrza jest tu zwykle ${AIR_LEVEL_PL[airLevel(ind.air)]}: to szybka orientacja, a nie dokładny odczyt.`;
}

const HEALTH_LABELS: Record<HealthKind, { label: string; nearest: string; none: string }> = {
  pharmacy: { label: "Apteki", nearest: "Najbliższa apteka", none: "apteki" },
  doctor: { label: "Lekarze i przychodnie", nearest: "Najbliższy gabinet lub przychodnia", none: "gabinetu ani przychodni" },
  hospital: { label: "Szpitale", nearest: "Najbliższy szpital", none: "szpitala" },
  post: { label: "Poczty", nearest: "Najbliższa poczta", none: "poczty" },
  bank: { label: "Banki", nearest: "Najbliższy bank", none: "banku" },
};

export type HealthPartInfo = { key: HealthKind; label: string; fact: string; score: number | null; sharePct: number };

/** One row per kind of place: what is nearby, the kind's own score and its share of the combined score. */
export function describeHealthParts(ind: HexIndicators): HealthPartInfo[] {
  const h = ind.health;
  if (!h) return [];
  return HEALTH_KINDS.map((key) => {
    const x = h[key];
    const l = HEALTH_LABELS[key];
    const reach = metres(HEALTH_SCALE[key] * 1000);
    const fact =
      x.nearestM === null
        ? `Brak ${l.none} w promieniu ${reach}`
        : `${l.nearest}: ${metres(x.nearestM)}${x.within1000 > 0 ? ` · w promieniu 1 km: ${x.within1000}` : ""}`;
    return { key, label: l.label, fact, score: x.score ?? null, sharePct: Math.round(HEALTH_WEIGHTS[key] * 100) };
  });
}

/** What the health-and-services figure can and cannot tell you. Shown in the panel. */
export const HEALTH_CAVEAT =
  "Liczą się tylko miejsca zmapowane w OpenStreetMap w pobliżu. Nie wiemy nic o godzinach otwarcia, kolejkach, jakości usług, kontraktach z NFZ ani o tym, czy gabinet przyjmuje nowych pacjentów. Wynik porównuje ten obszar z innymi obszarami Krakowa, to nie ocena okolicy i nie wchodzi do dopasowania.";

/** What the air-quality figure can and cannot tell you. Shown in the panel. */
export const AIR_CAVEAT =
  "To aktualna migawka (średnia z ostatnich kilku dni odczytów godzinowych), a nie średnia roczna, i oszacowanie pomiędzy kilkoma oficjalnymi stacjami, a nie pomiar w tym miejscu. Jakość powietrza mocno zmienia się z sezonem i pogodą. Źródło: GIOŚ.";

/** Night-time context shown next to the safety level. Informational: not part of the score. */
export function describeNightlife(ind: HexIndicators): string | null {
  const n = ind.safety?.nightlife;
  if (!n) return null;
  return n.venues > 0
    ? `${plCount(n.venues, "bar, pub lub klub", "bary, puby i kluby", "barów, pubów i klubów")} w promieniu ${metres(NIGHTLIFE_RADIUS_M)}`
    : `Brak barów, pubów i klubów w promieniu ${metres(NIGHTLIFE_RADIUS_M)}`;
}

/** What the safety level can and cannot tell you. Shown in the panel. */
export const SAFETY_NOT_INCLUDED =
  "Nie uwzględniono: statystyk przestępstw i zdarzeń (policja publikuje je tylko jako informacje prasowe, a nie dane otwarte), wypadków drogowych ani zgłoszeń mieszkańców (brak publicznego eksportu). Poziom opisuje otoczenie, a nie to, co się tam wydarzyło, i nie jest oceną obszaru.";

/** Short facts for tests and plain-text uses: the fact line of every indicator. */
export function describeSafety(ind: HexIndicators): string[] {
  return describeSafetyParts(ind).map((p) => p.fact);
}
