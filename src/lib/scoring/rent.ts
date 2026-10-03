import { z } from "zod";
import rentData from "../data/rent-data.json";

// Rent budget: a filter, not a preference weight. Hexes inherit the offers of their district (a snapshot of
// rental listings, see scripts/rent/build.ts) for the chosen flat size. The map fades toward grey where few of
// those offers fit the range; districts without enough listings stay "unknown". Ads show the base rent, so the
// budget can include the czynsz (building fee) that is listed separately.

export const RENT_MIN = 1500;
export const RENT_MAX = 7000;
export const RENT_STEP = 100;

export const ROOMS_OPTIONS = [
  { value: 1, label: "1 pokój" },
  { value: 2, label: "2 pokoje" },
  { value: 3, label: "3+ pokoje" },
] as const;
export type Rooms = (typeof ROOMS_OPTIONS)[number]["value"];
export const DEFAULT_ROOMS: Rooms = 2;

/** `min` at RENT_MIN or `max` at RENT_MAX means "no limit" on that side. */
export const rentFilterSchema = z
  .object({
    min: z.number().int().min(RENT_MIN).max(RENT_MAX),
    max: z.number().int().min(RENT_MIN).max(RENT_MAX),
    rooms: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    /** Compare the budget with base rent plus czynsz (the typical one when an ad does not state it). */
    fees: z.boolean(),
  })
  .refine((f) => f.min <= f.max, "min must not exceed max");
export type RentFilter = z.infer<typeof rentFilterSchema>;

export type RentStats = { n: number; p25: number; median: number; p75: number };
/** Stats of one district and flat size; `offers` are [base rent, czynsz or null] for every listing. */
export type RentGroup = RentStats & { fee: number | null; feeKnown: number; offers?: readonly (readonly [number, number | null])[] };
type RentTable = Record<string, Record<string, RentGroup>>;

export const RENT_META = {
  source: rentData.source,
  snapshot: rentData.snapshot,
  listings: rentData.listings,
};

const DISTRICTS = rentData.districts as unknown as RentTable;
const CITY = rentData.city as unknown as Record<string, RentGroup>;

/** Typical rent for a district and flat size; null when there were too few listings. */
export function rentFor(district: string | null | undefined, rooms: Rooms, table: RentTable = DISTRICTS): RentGroup | null {
  if (!district) return null;
  return table[district]?.[String(rooms)] ?? null;
}

export function cityRent(rooms: Rooms): RentGroup | null {
  return CITY[String(rooms)] ?? null;
}

/** Typical czynsz (building fee, on top of the base rent) for a district, falling back to the city figure. */
export function feeFor(district: string | null | undefined, rooms: Rooms, table: RentTable = DISTRICTS): number {
  return rentFor(district, rooms, table)?.fee ?? cityRent(rooms)?.fee ?? 0;
}

/** Offers at or above this share inside the budget are shown normally; below it the map fades toward grey. */
export const FULL_SHARE = 0.5;
/** Districts where fewer than this share of offers fit the budget count as outside it. */
export const OUT_SHARE = 0.2;

export type RentFit = "in" | "some" | "out" | "unknown";

/** Monthly cost of every offer; with `fees` the czynsz is added (the typical one when the ad does not state it). */
export function costsFor(district: string | null | undefined, rooms: Rooms, fees: boolean, table: RentTable = DISTRICTS): number[] | null {
  const group = rentFor(district, rooms, table);
  if (!group?.offers?.length) return null;
  const typical = group.fee ?? cityRent(rooms)?.fee ?? 0;
  return group.offers.map(([price, fee]) => (fees ? price + (fee ?? typical) : price));
}

/** Share of offers inside the budget; a handle at the end of the slider means no limit on that side. */
export function shareWithin(costs: readonly number[], filter: { min: number; max: number }): number {
  if (costs.length === 0) return 0;
  const inside = costs.filter((c) => (filter.min <= RENT_MIN || c >= filter.min) && (filter.max >= RENT_MAX || c <= filter.max));
  return inside.length / costs.length;
}

export function rentFit(share: number | null): RentFit {
  if (share === null) return "unknown";
  return share >= FULL_SHARE ? "in" : share >= OUT_SHARE ? "some" : "out";
}

export type RentSummary = {
  stats: RentGroup | null;
  /** Typical czynsz for this district and flat size (0 if unknown). */
  fee: number;
  share: number | null;
  /** Offers inside the budget, and how many there are. */
  within: number;
  fit: RentFit;
};

export function summarizeRent(district: string | null | undefined, filter: RentFilter, table?: RentTable): RentSummary {
  const stats = rentFor(district, filter.rooms, table);
  const costs = costsFor(district, filter.rooms, filter.fees, table);
  const share = costs ? shareWithin(costs, filter) : null;
  return {
    stats,
    fee: feeFor(district, filter.rooms, table),
    share,
    within: costs && share !== null ? Math.round(share * costs.length) : 0,
    fit: rentFit(share),
  };
}

/** Splits hexes by how many of their district's offers fit: outside the budget, unknown, and a share for grading the map. */
export function classifyHexes(
  hexes: readonly { h3Index: string; district?: string | null }[],
  filter: RentFilter,
  table?: RentTable,
): { over: Set<string>; unknown: Set<string>; share: Map<string, number> } {
  const over = new Set<string>();
  const unknown = new Set<string>();
  const share = new Map<string, number>();
  const byDistrict = new Map<string, number | null>();
  for (const h of hexes) {
    const key = h.district ?? "";
    if (!byDistrict.has(key)) byDistrict.set(key, summarizeRent(h.district, filter, table).share);
    const s = byDistrict.get(key) ?? null;
    if (s === null) unknown.add(h.h3Index);
    else {
      share.set(h.h3Index, s);
      if (rentFit(s) === "out") over.add(h.h3Index);
    }
  }
  return { over, unknown, share };
}

/** Turns a budget the model copied from the user ("do 3500 zł", "2-3 tys.") into a valid filter, or null. */
export function budgetToFilter(b: { min?: number | null; max?: number | null; rooms?: Rooms | null } | null | undefined): RentFilter | null {
  if (!b || (b.min == null && b.max == null)) return null;
  const snap = (n: number) => Math.min(RENT_MAX, Math.max(RENT_MIN, Math.round(n / RENT_STEP) * RENT_STEP));
  const min = b.min == null ? RENT_MIN : snap(b.min);
  const max = b.max == null ? RENT_MAX : snap(b.max);
  if (min > max) return null;
  const filter = { min, max, rooms: b.rooms ?? DEFAULT_ROOMS, fees: true };
  return min <= RENT_MIN && max >= RENT_MAX ? null : filter;
}

/** `rent=2500-4000&rooms=2`, plus `czynsz=0` when the budget is for the base rent only. */
export function rentToQuery(f: RentFilter): string {
  return `rent=${f.min}-${f.max}&rooms=${f.rooms}${f.fees ? "" : "&czynsz=0"}`;
}

export function rentFromQuery(params: Record<string, string | string[] | undefined>): RentFilter | null {
  const raw = params.rent;
  if (typeof raw !== "string") return null;
  const [min, max] = raw.split("-").map(Number);
  const rooms = params.rooms === undefined ? DEFAULT_ROOMS : Number(params.rooms);
  const parsed = rentFilterSchema.safeParse({ min, max, rooms, fees: params.czynsz !== "0" });
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
  // Otodom filters on the base rent, so a budget that includes czynsz is lowered by the typical fee.
  const fee = filter.fees ? feeFor(district, filter.rooms) : 0;
  const base = (n: number) => Math.max(0, Math.round((n - fee) / 50) * 50);
  if (filter.min > RENT_MIN) params.set("priceMin", String(base(filter.min)));
  if (filter.max < RENT_MAX) params.set("priceMax", String(base(filter.max)));
  return `${path}?${params}`;
}

/** 2500 -> "2 500 zł", grouped by hand because Polish locale data does not group four-digit numbers. */
export const formatZl = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} zł`;

/** "2 500 – 4 000 zł", "do 4 000 zł", "od 2 500 zł". */
export function formatRentRange(f: { min: number; max: number }): string {
  const noMin = f.min <= RENT_MIN;
  const noMax = f.max >= RENT_MAX;
  if (noMin && noMax) return "bez limitu";
  if (noMin) return `do ${formatZl(f.max)}`;
  if (noMax) return `od ${formatZl(f.min)}`;
  return `${formatZl(f.min)} – ${formatZl(f.max)}`;
}
