import { PARKING_CAVEAT, PARKING_COLORS } from "../scoring/parking";
import { PLACE_COLORS, GREEN_COLOR } from "./places";

// The "Map key": what each symbol on the map means. Pure data so it can be tested; map-key.tsx draws it.

export type KeyContext = {
  /** An area (hexagon) is open, so its pins, badges and rings are on the map. */
  areaOpen: boolean;
  /** "I have a car" is on, so parking pins are on the map. */
  car: boolean;
  /** A workplace is set, so the route and its marker can appear. */
  workplace: boolean;
  /** At least one area is being compared. */
  comparing: boolean;
  /** The city-plans timeline layer is switched on. */
  timeline?: boolean;
};

export type KeySymbol =
  | { kind: "dots"; colors: string[] }
  | { kind: "letter"; text: string; bg: string }
  | { kind: "dot"; color: string }
  | { kind: "badge"; icon: "safety" | "air" | "health" | "works" | "compare" }
  | { kind: "line"; color: string; dashed?: boolean }
  | { kind: "ring" }
  | { kind: "outline"; color: string; dashed?: boolean };

export type KeyEntry = {
  id: string;
  group: string;
  symbol: KeySymbol;
  label: string;
  meaning: string;
  when?: (ctx: KeyContext) => boolean;
};

export const KEY_GROUPS: { id: string; title: string; note?: string; when?: (ctx: KeyContext) => boolean }[] = [
  { id: "pins", title: "Miejsca wokół otwartego obszaru", when: (c) => c.areaOpen },
  { id: "parking", title: "Parking (masz samochód)", note: PARKING_CAVEAT, when: (c) => c.car },
  { id: "badges", title: "Na otwartym sześciokącie", when: (c) => c.areaOpen },
  { id: "timeline", title: "Plany i prace (oś czasu)", note: "Tylko oficjalne ogłoszenia. Nie zmieniają wyniku dopasowania.", when: (c) => c.timeline === true },
  { id: "lines", title: "Linie i obrysy" },
];

export const KEY_ENTRIES: KeyEntry[] = [
  { id: "tl-ongoing", group: "timeline", symbol: { kind: "dot", color: "#f59e0b" }, label: "Trwają", meaning: "Prace w toku w wybranym roku, według podanych dat." },
  { id: "tl-planned", group: "timeline", symbol: { kind: "dot", color: "#0ea5e9" }, label: "Planowane", meaning: "Ogłoszone plany przypadające na wybrany rok; termin bywa orientacyjny." },
  { id: "tl-unknown", group: "timeline", symbol: { kind: "ring" }, label: "Termin nieznany", meaning: "Blade znaczniki: źródło nie podaje, czy prace potrwają do tego roku, albo nie podaje terminu." },
  { id: "tl-permit", group: "timeline", symbol: { kind: "outline", color: "#64748b", dashed: true }, label: "Pozwolenie", meaning: "Wydano decyzję, ale nie opublikowano harmonogramu budowy." },
  {
    id: "places",
    group: "pins",
    symbol: { kind: "dots", colors: Object.values(PLACE_COLORS) },
    label: "Miejsca",
    meaning: "Kolor oznacza kategorię (sport, kultura, zakupy, transport, edukacja). Ikona pokazuje rodzaj, na przykład tramwaj, autobus, teatr lub szkołę.",
  },
  {
    id: "green",
    group: "pins",
    symbol: { kind: "outline", color: GREEN_COLOR },
    label: "Park lub las",
    meaning: "Tereny zielone, które liczą się do wyniku zieleni.",
  },
  {
    id: "carpark",
    group: "parking",
    symbol: { kind: "letter", text: "P", bg: PARKING_COLORS.carpark },
    label: "Parking lub garaż",
    meaning: "Dostępny publicznie. Najedź lub stuknij, aby zobaczyć, czy jest płatny i jak duży, jeśli mapa to podaje.",
  },
  {
    id: "parkride",
    group: "parking",
    symbol: { kind: "letter", text: "P+R", bg: PARKING_COLORS.parkride },
    label: "Parkuj i jedź (P+R)",
    meaning: "Parking do pozostawienia samochodu i przesiadki na transport publiczny.",
  },
  {
    id: "meter",
    group: "parking",
    symbol: { kind: "dot", color: PARKING_COLORS.meter },
    label: "Parkometr",
    meaning: "Parkowanie przy ulicy obok jest prawdopodobnie płatne. Dane miasta, stan: maj 2019.",
  },
  {
    id: "badge-safety",
    group: "badges",
    symbol: { kind: "badge", icon: "safety" },
    label: "Bezpieczeństwo",
    meaning: "Wynik wskaźników bezpieczeństwa tego obszaru. Stuknij, aby zobaczyć szczegóły.",
  },
  {
    id: "badge-air",
    group: "badges",
    symbol: { kind: "badge", icon: "air" },
    label: "Jakość powietrza",
    meaning: "Wynik jakości powietrza z najbliższych stacji. Stuknij, aby zobaczyć szczegóły.",
  },
  {
    id: "badge-health",
    group: "badges",
    symbol: { kind: "badge", icon: "health" },
    label: "Zdrowie i usługi",
    meaning: "Dostęp do aptek, lekarzy, szpitali, poczt i banków w pobliżu. Stuknij, aby zobaczyć szczegóły.",
  },
  {
    id: "badge-works",
    group: "badges",
    symbol: { kind: "badge", icon: "works" },
    label: "Prace w pobliżu",
    meaning: "Liczba prac budowlanych lub remontowych w pobliżu tego obszaru.",
  },
  {
    id: "badge-compare",
    group: "badges",
    symbol: { kind: "badge", icon: "compare" },
    label: "Dodaj do porównania",
    meaning: "Dodaje ten obszar (maksymalnie trzy) do porównania obok siebie; ptaszek oznacza, że już tam jest.",
  },
  {
    id: "rings",
    group: "lines",
    symbol: { kind: "ring" },
    label: "Okręgi 500 m i 1 km",
    meaning: "Odległość od środka otwartego obszaru. Fakty w panelu opierają się na tych odległościach.",
    when: (c) => c.areaOpen,
  },
  {
    id: "compared",
    group: "lines",
    symbol: { kind: "outline", color: "#0f172a", dashed: true },
    label: "Porównywany obszar",
    meaning: "Obszar dodany do porównania.",
    when: (c) => c.comparing,
  },
  {
    id: "districts",
    group: "lines",
    symbol: { kind: "line", color: "#334155" },
    label: "Granice dzielnic",
    meaning: "Pokazywane przyciskiem „Granice dzielnic”.",
  },
  {
    id: "route",
    group: "lines",
    symbol: { kind: "line", color: "#0369a1" },
    label: "Trasa do miejsca pracy",
    meaning: "Od otwartego obszaru do miejsca pracy. Linia przerywana oznacza linię prostą (transport publiczny jest szacowany, a nie wyznaczany).",
    when: (c) => c.workplace && c.areaOpen,
  },
  {
    id: "work",
    group: "lines",
    symbol: { kind: "dot", color: "#0369a1" },
    label: "Twoje miejsce pracy",
    meaning: "Miejsce, które podałeś w czacie.",
    when: (c) => c.workplace && c.areaOpen,
  },
];

export type KeySection = { id: string; title: string; note?: string; entries: KeyEntry[] };

/** Only the sections and entries that apply to what is on the map right now. */
export function keySections(ctx: KeyContext): KeySection[] {
  return KEY_GROUPS.filter((g) => g.when?.(ctx) ?? true)
    .map((g) => ({
      id: g.id,
      title: g.title,
      note: g.note,
      entries: KEY_ENTRIES.filter((e) => e.group === g.id && (e.when?.(ctx) ?? true)),
    }))
    .filter((s) => s.entries.length > 0);
}
