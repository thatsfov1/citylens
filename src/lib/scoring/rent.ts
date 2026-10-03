import { z } from "zod";
import rentData from "../data/rent-data.json";

// Rent budget: a filter, not a preference weight. Hexes inherit the typical asking rent of their district
// (a snapshot of rental listings, see scripts/rent/build.ts) for the chosen flat size. Hexes whose typical
// rent lies outside the range are greyed out; districts without enough listings stay "unknown".

export const RENT_MIN = 1500;
export const RENT_MAX = 7000;
export const RENT_STEP = 100;

export const ROOMS_OPTIONS = [
  { value: 1, label: "1 room" },
  { value: 2, label: "2 rooms" },
  { value: 3, label: "3+ rooms" },
] as const;
export type Rooms = (typeof ROOMS_OPTIONS)[number]["value"];
export const DEFAULT_ROOMS: Rooms = 2;

/** `min` at RENT_MIN or `max` at RENT_MAX means "no limit" on that side. */
export const rentFilterSchema = z
  .object({
    min: z.number().int().min(RENT_MIN).max(RENT_MAX),
    max: z.number().int().min(RENT_MIN).max(RENT_MAX),
    rooms: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .refine((f) => f.min <= f.max, "min must not exceed max");
export type RentFilter = z.infer<typeof rentFilterSchema>;

export type RentStats = { n: number; p25: number; median: number; p75: number };
type RentTable = Record<string, Record<string, RentStats>>;

export const RENT_META = {
  source: rentData.source,
  snapshot: rentData.snapshot,
  listings: rentData.listings,
};

/** Typical rent for a district and flat size; null when there were too few listings. */
export function rentFor(district: string | null | undefined, rooms: Rooms, table: RentTable = rentData.districts as RentTable): RentStats | null {
  if (!district) return null;
  return table[district]?.[String(rooms)] ?? null;
}

export function cityRent(rooms: Rooms): RentStats | null {
  return (rentData.city as Record<string, RentStats>)[String(rooms)] ?? null;
}

export type RentFit = "in" | "out" | "unknown";

/** Whether a district's typical (median) rent lies within the budget. */
export function rentFit(stats: RentStats | null, filter: RentFilter): RentFit {
  if (!stats) return "unknown";
  const aboveMin = filter.min <= RENT_MIN || stats.median >= filter.min;
  const belowMax = filter.max >= RENT_MAX || stats.median <= filter.max;
  return aboveMin && belowMax ? "in" : "out";
}

/** Splits hexes into out-of-budget and unknown sets (the rest are in budget). */
export function classifyHexes(
  hexes: readonly { h3Index: string; district?: string | null }[],
  filter: RentFilter,
  table?: RentTable,
): { over: Set<string>; unknown: Set<string> } {
  const over = new Set<string>();
  const unknown = new Set<string>();
  for (const h of hexes) {
    const fit = rentFit(rentFor(h.district, filter.rooms, table), filter);
    if (fit === "out") over.add(h.h3Index);
    else if (fit === "unknown") unknown.add(h.h3Index);
  }
  return { over, unknown };
}

/** Turns a budget the model copied from the user ("do 3500 zł", "2-3 tys.") into a valid filter, or null. */
export function budgetToFilter(b: { min?: number | null; max?: number | null; rooms?: Rooms | null } | null | undefined): RentFilter | null {
  if (!b || (b.min == null && b.max == null)) return null;
  const snap = (n: number) => Math.min(RENT_MAX, Math.max(RENT_MIN, Math.round(n / RENT_STEP) * RENT_STEP));
  const min = b.min == null ? RENT_MIN : snap(b.min);
  const max = b.max == null ? RENT_MAX : snap(b.max);
  if (min > max) return null;
  const filter = { min, max, rooms: b.rooms ?? DEFAULT_ROOMS };
  return min <= RENT_MIN && max >= RENT_MAX ? null : filter;
}

/** `rent=2500-4000&rooms=2`; the extremes mean "no limit". */
export function rentToQuery(f: RentFilter): string {
  return `rent=${f.min}-${f.max}&rooms=${f.rooms}`;
}

export function rentFromQuery(params: Record<string, string | string[] | undefined>): RentFilter | null {
  const raw = params.rent;
  if (typeof raw !== "string") return null;
  const [min, max] = raw.split("-").map(Number);
  const rooms = params.rooms === undefined ? DEFAULT_ROOMS : Number(params.rooms);
  const parsed = rentFilterSchema.safeParse({ min, max, rooms });
  if (!parsed.success) return null;
  // A range spanning everything filters nothing.
  return parsed.data.min <= RENT_MIN && parsed.data.max >= RENT_MAX ? null : parsed.data;
}

const OTODOM_BASE = "https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/malopolskie/krakow/krakow/krakow";
const OTODOM_ROOMS: Record<Rooms, string> = { 1: "[ONE]", 2: "[TWO]", 3: "[THREE,FOUR,FIVE,SIX_OR_MORE]" };

/** "Bieżanów-Prokocim" -> "biezanow--prokocim", the way Otodom spells district paths. */
export function otodomDistrictSlug(district: string): string {
  return district
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/-/g, "--")
    .replace(/\s+/g, "-");
}

/** Link to the same offers on Otodom, with the user's district, flat size and price range applied. */
export function otodomUrl(filter: RentFilter, district?: string | null): string {
  const path = district ? `${OTODOM_BASE}/${otodomDistrictSlug(district)}` : OTODOM_BASE;
  const params = new URLSearchParams();
  params.set("roomsNumber", OTODOM_ROOMS[filter.rooms]);
  if (filter.min > RENT_MIN) params.set("priceMin", String(filter.min));
  if (filter.max < RENT_MAX) params.set("priceMax", String(filter.max));
  return `${path}?${params}`;
}

/** 2500 -> "2 500 zł", grouped by hand because Polish locale data does not group four-digit numbers. */
export const formatZl = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} zł`;

/** "2 500 – 4 000 zł", "up to 4 000 zł", "from 2 500 zł". */
export function formatRentRange(f: { min: number; max: number }): string {
  const noMin = f.min <= RENT_MIN;
  const noMax = f.max >= RENT_MAX;
  if (noMin && noMax) return "any rent";
  if (noMin) return `up to ${formatZl(f.max)}`;
  if (noMax) return `from ${formatZl(f.min)}`;
  return `${formatZl(f.min)} – ${formatZl(f.max)}`;
}
