// One-off snapshot of rental asking prices -> per-district stats used by the budget filter.
// Usage: npx tsx scripts/rent/build.ts            (fetches ~45 result pages, then aggregates)
//        FETCH=0 npx tsx scripts/rent/build.ts    (re-aggregate data/rent/listings.json only)
// Output: data/rent/listings.json (id, district, rooms, price, area) and src/lib/data/rent-data.json.
// Polite by design: sequential requests, a pause between pages, a modest page cap, no per-listing requests.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const BASE = "https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/malopolskie/krakow/krakow/krakow";
const PAGES = Number(process.env.PAGES ?? 45);
const PAUSE_MS = 2000;
const LISTINGS_FILE = "data/rent/listings.json";
const OUT_FILE = "src/lib/data/rent-data.json";
const MIN_N = 5;

type Listing = { id: number; district: string; rooms: number; price: number; area: number | null };
type Item = {
  id: number;
  totalPrice?: { value: number; currency: string } | null;
  areaInSquareMeters?: number | null;
  roomsNumber?: string | null;
  location?: { reverseGeocoding?: { locations?: { name: string; locationLevel: string }[] } };
};

const ROOMS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10, MORE: 11 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page: number): Promise<Item[]> {
  const res = await fetch(`${BASE}?limit=36&page=${page}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "pl" },
  });
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`page ${page}: no __NEXT_DATA__`);
  return JSON.parse(m[1]).props.pageProps.data.searchAds.items as Item[];
}

function toListing(i: Item): Listing | null {
  const price = i.totalPrice?.currency === "PLN" ? i.totalPrice.value : null;
  const rooms = i.roomsNumber ? ROOMS[i.roomsNumber] : undefined;
  const district = i.location?.reverseGeocoding?.locations?.find((l) => l.locationLevel === "district")?.name;
  if (!price || !rooms || !district || price < 500 || price > 30000) return null;
  return { id: i.id, district, rooms, price, area: i.areaInSquareMeters ?? null };
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

const stats = (prices: number[]) => {
  const s = [...prices].sort((a, b) => a - b);
  return { n: s.length, p25: quantile(s, 0.25), median: quantile(s, 0.5), p75: quantile(s, 0.75) };
};

async function main() {
  const byId = new Map<number, Listing>();
  if (existsSync(LISTINGS_FILE)) for (const l of JSON.parse(readFileSync(LISTINGS_FILE, "utf8")) as Listing[]) byId.set(l.id, l);
  if (process.env.FETCH !== "0") {
    byId.clear();
    for (let p = 1; p <= PAGES; p++) {
      const items = await fetchPage(p);
      if (items.length === 0) break;
      for (const i of items) {
        const l = toListing(i);
        if (l) byId.set(l.id, l);
      }
      console.log(`page ${p}: ${items.length} items, ${byId.size} usable so far`);
      await sleep(PAUSE_MS);
    }
    writeFileSync(LISTINGS_FILE, JSON.stringify([...byId.values()]));
  }

  const listings = [...byId.values()];
  const bucket = (rooms: number) => String(Math.min(rooms, 3)); // "1", "2", "3" (= 3 or more)
  const group = (filter: (l: Listing) => boolean) => {
    const out: Record<string, ReturnType<typeof stats>> = {};
    for (const b of ["1", "2", "3"]) {
      const prices = listings.filter((l) => filter(l) && bucket(l.rooms) === b).map((l) => l.price);
      if (prices.length >= MIN_N) out[b] = stats(prices);
    }
    return out;
  };
  const districts: Record<string, ReturnType<typeof group>> = {};
  for (const d of [...new Set(listings.map((l) => l.district))].sort()) districts[d] = group((l) => l.district === d);

  const data = {
    source: "Otodom.pl rental asking prices (PLN / month)",
    snapshot: new Date().toISOString().slice(0, 10),
    listings: listings.length,
    minListings: MIN_N,
    city: group(() => true),
    districts,
  };
  writeFileSync(OUT_FILE, JSON.stringify(data, null, 1) + "\n");
  console.log(`wrote ${OUT_FILE}: ${listings.length} listings, ${Object.keys(districts).length} districts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
