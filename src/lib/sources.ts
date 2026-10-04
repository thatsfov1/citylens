import type { Category } from "@/types";

/**
 * Where every fact on the map comes from. One entry per source, so the area panel, the filters and the
 * legend say the same thing. `asOf` is only ever a date we actually stored (checked against the data files
 * in `sources.test.ts`); where we did not store one it is `null` and the UI says so — never a guess.
 */
export type SourceId = "osm" | "gios" | "gtfs" | "msip" | "zdmk" | "krakow" | "otodom" | "osrm" | "nominatim";
export type SourceKind = "measured" | "official" | "listing" | "routing";
/** ISO date, `YYYY-MM`, `YYYYMMDD`, "live" (queried at request time) or null (not recorded). */
export type AsOf = string | "live" | null;

export type Source = {
  id: SourceId;
  label: string;
  /** Short chip text. */
  short: string;
  provides: string;
  kind: SourceKind;
  license: string;
  url: string;
  asOf: AsOf;
};

export const KIND_LABEL: Record<SourceKind, string> = {
  measured: "Dane pomiarowe / mapowe",
  official: "Dane urzędowe",
  listing: "Oferty rynkowe",
  routing: "Usługa na żywo",
};

export const SOURCES: Record<SourceId, Source> = {
  osm: {
    id: "osm",
    label: "OpenStreetMap",
    short: "OSM",
    provides: "Miejsca (sport, kultura, sklepy, szkoły), parki i zieleń, przystanki, oświetlenie i monitoring.",
    kind: "measured",
    license: "ODbL © współtwórcy OpenStreetMap",
    url: "https://www.openstreetmap.org/copyright",
    asOf: "2026-10-03",
  },
  gios: {
    id: "gios",
    label: "GIOŚ — Główny Inspektorat Ochrony Środowiska",
    short: "GIOŚ",
    provides: "Stężenia pyłów PM2,5 i PM10 ze stacji pomiarowych (migawka, wartości szacowane między stacjami).",
    kind: "measured",
    license: "Dane publiczne GIOŚ",
    url: "https://powietrze.gios.gov.pl/",
    asOf: "2026-10-03",
  },
  gtfs: {
    id: "gtfs",
    label: "ZTP Kraków — rozkłady jazdy (GTFS)",
    short: "ZTP",
    provides: "Częstotliwość kursów na przystankach w godzinach 6:00–22:00.",
    kind: "official",
    license: "Dane otwarte ZTP Kraków",
    url: "https://gtfs.ztp.krakow.pl/",
    asOf: "2026-10-06",
  },
  msip: {
    id: "msip",
    label: "MSIP — GIS Miasta Krakowa",
    short: "MSIP",
    provides: "Parkometry i decyzje urzędowe (m.in. zezwolenia na usunięcie drzew przy inwestycjach).",
    kind: "official",
    license: "Dane publiczne Miasta Krakowa",
    url: "https://msip.um.krakow.pl/",
    asOf: null,
  },
  zdmk: {
    id: "zdmk",
    label: "ZDMK — Zarząd Dróg Miasta Krakowa",
    short: "ZDMK",
    provides: "Strefa płatnego parkowania, opłaty oraz ogłoszenia o pracach drogowych i torowych.",
    kind: "official",
    license: "Informacje publiczne ZDMK",
    url: "https://zdmk.krakow.pl/",
    asOf: null,
  },
  krakow: {
    id: "krakow",
    label: "krakow.pl — ogłoszenia Miasta",
    short: "krakow.pl",
    provides: "Oficjalne ogłoszenia o planowanych i trwających inwestycjach.",
    kind: "official",
    license: "Informacje publiczne Miasta Krakowa",
    url: "https://www.krakow.pl/",
    asOf: null,
  },
  otodom: {
    id: "otodom",
    label: "Otodom.pl",
    short: "Otodom",
    provides: "Ceny ofertowe wynajmu (nie transakcyjne), zebrane według dzielnic.",
    kind: "listing",
    license: "Dane z publicznych ogłoszeń, użyte w formie zagregowanej",
    url: "https://www.otodom.pl/",
    asOf: "2026-10-03",
  },
  osrm: {
    id: "osrm",
    label: "OSRM (FOSSGIS) — wyznaczanie tras",
    short: "OSRM",
    provides: "Czas dojazdu pieszo, rowerem i samochodem do wskazanego miejsca.",
    kind: "routing",
    license: "Dane drogowe © OpenStreetMap (ODbL)",
    url: "https://routing.openstreetmap.de/",
    asOf: "live",
  },
  nominatim: {
    id: "nominatim",
    label: "Nominatim — wyszukiwanie adresów",
    short: "Nominatim",
    provides: "Zamiana nazwy miejsca lub adresu na współrzędne.",
    kind: "routing",
    license: "Dane © OpenStreetMap (ODbL)",
    url: "https://nominatim.org/",
    asOf: "live",
  },
};

export type SourceTopic = Category | "air" | "safety" | "works" | "parking" | "rent" | "commute";

/** Which sources stand behind each topic shown in the panel. */
export const SOURCES_BY_TOPIC: Record<SourceTopic, readonly SourceId[]> = {
  sport: ["osm"],
  culture: ["osm"],
  greenery: ["osm"],
  shopping: ["osm"],
  education: ["osm"],
  transport: ["osm", "gtfs"],
  air: ["gios"],
  safety: ["osm"],
  works: ["zdmk", "krakow", "msip"],
  parking: ["osm", "msip", "zdmk"],
  rent: ["otodom"],
  commute: ["osrm", "gtfs", "nominatim"],
};

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/** "paź 2026" for month precision, "3 paź 2026" for a day, "na żywo", or an honest "data pobrania nieznana". */
export function formatAsOf(asOf: AsOf): string {
  if (asOf === "live") return "na żywo";
  if (!asOf) return "data pobrania nieznana";
  const m = /^(\d{4})-?(\d{2})(?:-?(\d{2}))?$/.exec(asOf);
  if (!m) return "data pobrania nieznana";
  const month = Number(m[2]);
  if (month < 1 || month > 12) return "data pobrania nieznana";
  return m[3] ? `${Number(m[3])} ${MONTHS[month - 1]} ${m[1]}` : `${MONTHS[month - 1]} ${m[1]}`;
}
