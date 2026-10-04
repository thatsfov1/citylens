// Experiment: can asking rents be shown at a finer level than the district? Otodom's result pages already carry the
// neighbourhood ("residential") and the street of every listing, so no per-listing requests are needed.
// Usage: npx tsx scripts/rent/osiedle-check.ts            (fetches ~45 result pages, 2 s apart, then reports)
//        FETCH=0 npx tsx scripts/rent/osiedle-check.ts    (report from data/rent/listings-osiedle.json only)
// Writes data/rent/listings-osiedle.json; does NOT touch the shipped snapshot (rent-data.json, listings.json).
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const BASE = "https://www.otodom.pl/pl/wyniki/wynajem/mieszkanie/malopolskie/krakow/krakow/krakow";
const PAGES = Number(process.env.PAGES ?? 45);
const FILE = "data/rent/listings-osiedle.json";
const ROOMS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6 };

type Row = {
  id: number;
  district: string;
  area: string | null;
  /** Otodom's path segment for the neighbourhood, e.g. "przedmiescie-warszawskie" (for links). */
  slug: string | null;
  street: string | null;
  rooms: number;
  price: number;
  /** Czynsz administracyjny, listed separately from the headline rent. */
  fee: number | null;
};
type Loc = { id?: string; name: string; locationLevel: string };
type Item = {
  id: number;
  totalPrice?: { value: number; currency: string } | null;
  rentPrice?: { value: number; currency: string } | null;
  roomsNumber?: string | null;
  location?: { address?: { street?: { name?: string } | null }; reverseGeocoding?: { locations?: Loc[] } };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function page(p: number): Promise<Item[]> {
  const res = await fetch(`${BASE}?limit=36&page=${p}`, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "pl" },
  });
  if (!res.ok) throw new Error(`page ${p}: HTTP ${res.status}`);
  const m = (await res.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`page ${p}: no __NEXT_DATA__`);
  return JSON.parse(m[1]).props.pageProps.data.searchAds.items as Item[];
}

function toRow(i: Item): Row | null {
  const levels = i.location?.reverseGeocoding?.locations ?? [];
  const district = levels.find((l) => l.locationLevel === "district")?.name;
  const rooms = i.roomsNumber ? ROOMS[i.roomsNumber] : undefined;
  const price = i.totalPrice?.currency === "PLN" ? i.totalPrice.value : null;
  if (!district || !rooms || !price || price < 500 || price > 30000) return null;
  const residential = levels.find((l) => l.locationLevel === "residential");
  const fee = i.rentPrice?.currency === "PLN" && i.rentPrice.value > 0 && i.rentPrice.value <= 5000 ? i.rentPrice.value : null;
  return {
    id: i.id,
    district,
    area: residential?.name ?? null,
    slug: residential?.id?.split("/").pop() ?? null,
    fee,
    street: i.location?.address?.street?.name?.replace(/^ul\.\s*/i, "") ?? null,
    rooms,
    price,
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

async function main() {
  let rows: Row[] = [];
  if (process.env.FETCH !== "0" || !existsSync(FILE)) {
    const byId = new Map<number, Row>();
    for (let p = 1; p <= PAGES; p++) {
      const items = await page(p);
      if (items.length === 0) break;
      for (const i of items) {
        const r = toRow(i);
        if (r) byId.set(r.id, r);
      }
      console.log(`page ${p}: ${items.length} items, ${byId.size} usable`);
      await sleep(2000);
    }
    rows = [...byId.values()];
    writeFileSync(FILE, JSON.stringify(rows));
  } else rows = JSON.parse(readFileSync(FILE, "utf8"));

  // ---- report ----
  const withArea = rows.filter((r) => r.area);
  console.log(`\n${rows.length} listings; ${withArea.length} with a neighbourhood, ${rows.filter((r) => r.street).length} with a street`);
  const counts = new Map<string, number>();
  for (const r of withArea) counts.set(`${r.district}|${r.area}`, (counts.get(`${r.district}|${r.area}`) ?? 0) + 1);
  const sizes = [...counts.values()].sort((a, b) => b - a);
  const share = (min: number) => Math.round((100 * sizes.filter((n) => n >= min).reduce((a, b) => a + b, 0)) / withArea.length);
  console.log(`${counts.size} neighbourhoods; with n>=5: ${sizes.filter((n) => n >= 5).length} (${share(5)}% of listings); n>=10: ${sizes.filter((n) => n >= 10).length} (${share(10)}%)`);

  // How much do neighbourhoods differ from their district? (2-room flats, neighbourhoods with n>=5 listings of any size)
  console.log("\nDistrict median vs neighbourhood medians (2 rooms, neighbourhoods with >= 5 two-room offers):");
  const districts = [...new Set(rows.map((r) => r.district))].sort();
  let materially = 0;
  let comparable = 0;
  for (const d of districts) {
    const dr = rows.filter((r) => r.district === d && r.rooms === 2);
    if (dr.length < 5) continue;
    const dm = median(dr.map((r) => r.price));
    const byArea = new Map<string, number[]>();
    for (const r of dr) if (r.area) byArea.set(r.area, [...(byArea.get(r.area) ?? []), r.price]);
    const big = [...byArea].filter(([, v]) => v.length >= 5).map(([a, v]) => [a, median(v), v.length] as const);
    if (big.length === 0) continue;
    for (const [, m] of big) {
      comparable++;
      if (Math.abs(m - dm) / dm >= 0.1) materially++;
    }
    console.log(`  ${d} (${dr.length}, median ${dm}): ${big.map(([a, m, n]) => `${a} ${m} (${n})`).join("; ")}`);
  }
  console.log(`\n${materially} of ${comparable} comparable neighbourhoods differ from their district median by 10% or more`);
}
main();
