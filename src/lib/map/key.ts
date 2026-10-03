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
};

export type KeySymbol =
  | { kind: "dots"; colors: string[] }
  | { kind: "letter"; text: string; bg: string }
  | { kind: "dot"; color: string }
  | { kind: "badge"; icon: "safety" | "air" | "works" | "compare" }
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
  { id: "pins", title: "Places around the open area", when: (c) => c.areaOpen },
  { id: "parking", title: "Parking (you have a car)", note: PARKING_CAVEAT, when: (c) => c.car },
  { id: "badges", title: "On the open hexagon", when: (c) => c.areaOpen },
  { id: "lines", title: "Lines and outlines" },
];

export const KEY_ENTRIES: KeyEntry[] = [
  {
    id: "places",
    group: "pins",
    symbol: { kind: "dots", colors: Object.values(PLACE_COLORS) },
    label: "Places",
    meaning: "Coloured by category (sport, culture, shopping, transport, education). The icon shows the kind, for example a tram, bus, theatre or school.",
  },
  {
    id: "green",
    group: "pins",
    symbol: { kind: "outline", color: GREEN_COLOR },
    label: "Park or forest",
    meaning: "Green areas that count toward the Greenery score.",
  },
  {
    id: "carpark",
    group: "parking",
    symbol: { kind: "letter", text: "P", bg: PARKING_COLORS.carpark },
    label: "Car park or garage",
    meaning: "Open to the public. Hover or tap it to see whether it is paid and how big it is, when the map says so.",
  },
  {
    id: "parkride",
    group: "parking",
    symbol: { kind: "letter", text: "P+R", bg: PARKING_COLORS.parkride },
    label: "Park and ride",
    meaning: "A car park meant for leaving the car and taking public transport.",
  },
  {
    id: "meter",
    group: "parking",
    symbol: { kind: "dot", color: PARKING_COLORS.meter },
    label: "Parking meter",
    meaning: "Street parking next to it is probably paid. City data, state May 2019.",
  },
  {
    id: "badge-safety",
    group: "badges",
    symbol: { kind: "badge", icon: "safety" },
    label: "Safety",
    meaning: "Safety indicators score of this area. Tap it for the details.",
  },
  {
    id: "badge-air",
    group: "badges",
    symbol: { kind: "badge", icon: "air" },
    label: "Air quality",
    meaning: "Air quality score from the nearest stations. Tap it for the details.",
  },
  {
    id: "badge-works",
    group: "badges",
    symbol: { kind: "badge", icon: "works" },
    label: "Works nearby",
    meaning: "Number of construction or renovation works close to this area.",
  },
  {
    id: "badge-compare",
    group: "badges",
    symbol: { kind: "badge", icon: "compare" },
    label: "Add to comparison",
    meaning: "Adds this area (up to three) to the side-by-side comparison; a tick means it is already there.",
  },
  {
    id: "rings",
    group: "lines",
    symbol: { kind: "ring" },
    label: "500 m and 1 km rings",
    meaning: "Distance from the centre of the open area. The facts in the panel use these distances.",
    when: (c) => c.areaOpen,
  },
  {
    id: "compared",
    group: "lines",
    symbol: { kind: "outline", color: "#0f172a", dashed: true },
    label: "Compared area",
    meaning: "An area you added to the comparison.",
    when: (c) => c.comparing,
  },
  {
    id: "strongest",
    group: "lines",
    symbol: { kind: "outline", color: "#0f5132" },
    label: "Strongest areas",
    meaning: "Shown by the “Strongest areas” button: the top tenth of cells for the current tab.",
  },
  {
    id: "districts",
    group: "lines",
    symbol: { kind: "line", color: "#334155" },
    label: "District borders",
    meaning: "Shown by the “District borders” button.",
  },
  {
    id: "route",
    group: "lines",
    symbol: { kind: "line", color: "#0369a1" },
    label: "Route to your workplace",
    meaning: "From the open area to your workplace. Dashed means a straight line (public transport is estimated, not routed).",
    when: (c) => c.workplace && c.areaOpen,
  },
  {
    id: "work",
    group: "lines",
    symbol: { kind: "dot", color: "#0369a1" },
    label: "Your workplace",
    meaning: "The place you named in the chat.",
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
