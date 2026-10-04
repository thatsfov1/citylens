// Sanity checks for the stored hex scores. Expectations come from what anyone who knows Kraków would say
// (the Old Town is the cultural centre, Las Wolski is green, ...), written down BEFORE looking at the numbers.
// A failure means either the data/scoring is off or the expectation is wrong; either is worth knowing.
import { cellToLatLng, latLngToCell } from "h3-js";
import { CATS, type Cat, type SeedRow } from "./seed";

export type Check = { name: string; ok: boolean; detail: string };

/** Rynek Główny: the reference point for "distance from the centre". */
export const CENTRE: [number, number] = [50.0617, 19.9373];

export const LANDMARKS: { name: string; at: [number, number]; cat: Cat; minPercentile: number }[] = [
  { name: "Rynek Główny", at: [50.0617, 19.9373], cat: "culture", minPercentile: 90 },
  { name: "Rynek Główny", at: [50.0617, 19.9373], cat: "transport", minPercentile: 90 },
  { name: "Dworzec Główny", at: [50.0680, 19.9475], cat: "transport", minPercentile: 90 },
  { name: "Galeria Krakowska", at: [50.0665, 19.9455], cat: "shopping", minPercentile: 80 },
  { name: "Bonarka City Center", at: [50.0165, 19.9515], cat: "shopping", minPercentile: 70 },
  { name: "Błonia", at: [50.0612, 19.9072], cat: "greenery", minPercentile: 80 },
  { name: "Las Wolski", at: [50.0540, 19.8650], cat: "greenery", minPercentile: 90 },
  { name: "Uniwersytet Jagielloński (Collegium Novum)", at: [50.0614, 19.9334], cat: "education", minPercentile: 80 },
  { name: "AGH", at: [50.0647, 19.9234], cat: "education", minPercentile: 70 },
  { name: "Plac Centralny, Nowa Huta", at: [50.0713, 20.0373], cat: "transport", minPercentile: 60 },
];

/** Share of cells (0-100) scoring below this one, ties counted half. */
export function percentile(values: number[], v: number): number {
  const below = values.filter((x) => x < v).length;
  const equal = values.filter((x) => x === v).length;
  return ((below + equal / 2) / values.length) * 100;
}

export function districtMeans(rows: SeedRow[], cat: Cat): [string, number][] {
  const sums = new Map<string, { s: number; n: number }>();
  for (const r of rows) {
    const k = r.district ?? "(no district)";
    const e = sums.get(k) ?? { s: 0, n: 0 };
    e.s += r.scores[cat];
    e.n += 1;
    sums.set(k, e);
  }
  return [...sums].map(([k, e]): [string, number] => [k, e.s / e.n]).sort((a, b) => b[1] - a[1]);
}

function ranks(xs: number[]): number[] {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    for (let k = i; k <= j; k++) out[idx[k]] = (i + j) / 2;
    i = j + 1;
  }
  return out;
}

export function spearman(a: number[], b: number[]): number {
  const ra = ranks(a), rb = ranks(b);
  const n = a.length;
  const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

const km = (a: [number, number], b: [number, number]) => {
  const dLat = (a[0] - b[0]) * 111.2;
  const dLng = (a[1] - b[1]) * 111.2 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

export function runChecks(rows: SeedRow[]): Check[] {
  const out: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail });
  const byId = new Map(rows.map((r) => [r.h3, r]));

  // Structure
  add("461 unique cells", rows.length === 461 && byId.size === 461, `${rows.length} rows, ${byId.size} unique`);
  const bad = rows.filter((r) => CATS.some((c) => !(r.scores[c] >= 0 && r.scores[c] <= 100)));
  add("every score is within 0-100", bad.length === 0, `${bad.length} cells out of range`);
  add("every cell has a district", rows.every((r) => r.district), `${rows.filter((r) => !r.district).length} without`);
  for (const c of CATS) {
    const zeros = rows.filter((r) => r.scores[c] === 0).length;
    const max = Math.max(...rows.map((r) => r.scores[c]));
    add(`${c}: not mostly empty, uses the scale`, zeros / rows.length < 0.3 && max >= 90, `${zeros} zero cells, max ${max}`);
  }

  // Landmarks: the cell that contains a well-known place should rank high for what the place is known for.
  for (const l of LANDMARKS) {
    const cell = byId.get(latLngToCell(l.at[0], l.at[1], 8));
    if (!cell) {
      add(`${l.name}: ${l.cat}`, false, "cell not in the grid");
      continue;
    }
    const p = percentile(rows.map((r) => r.scores[l.cat]), cell.scores[l.cat]);
    add(`${l.name}: ${l.cat} in the top ${100 - l.minPercentile}%`, p >= l.minPercentile, `score ${cell.scores[l.cat]}, percentile ${p.toFixed(0)}`);
  }

  // Districts: the Old Town leads the urban categories, and the outskirts trail it.
  const rank = (cat: Cat, d: string) => districtMeans(rows, cat).findIndex(([k]) => k === d) + 1;
  for (const cat of ["culture", "transport"] as const)
    add(`Stare Miasto is a top-2 district for ${cat}`, rank(cat, "Stare Miasto") <= 2, `rank ${rank(cat, "Stare Miasto")} of 18`);
  add("Zwierzyniec (Las Wolski, Błonia) is a top-3 district for greenery", rank("greenery", "Zwierzyniec") <= 3, `rank ${rank("greenery", "Zwierzyniec")} of 18`);
  const mean = (d: string, c: Cat) => districtMeans(rows, c).find(([k]) => k === d)?.[1] ?? NaN;
  for (const cat of ["culture", "transport", "shopping", "education"] as const)
    add(`Stare Miasto beats Wzgórza Krzesławickie for ${cat}`, mean("Stare Miasto", cat) > mean("Wzgórza Krzesławickie", cat), `${mean("Stare Miasto", cat).toFixed(0)} vs ${mean("Wzgórza Krzesławickie", cat).toFixed(0)}`);

  // Distance from the centre: transport and shopping fall off, greenery does not.
  const dist = rows.map((r) => km(CENTRE, cellToLatLng(r.h3) as [number, number]));
  for (const cat of ["transport", "shopping", "culture"] as const) {
    const rho = spearman(dist, rows.map((r) => r.scores[cat]));
    add(`${cat} falls with distance from the centre (Spearman < -0.3)`, rho < -0.3, `rho ${rho.toFixed(2)}`);
  }
  const rhoG = spearman(dist, rows.map((r) => r.scores.greenery));
  add("greenery is not just a centre effect (Spearman > -0.3)", rhoG > -0.3, `rho ${rhoG.toFixed(2)}`);

  // Cross-check between independent sources: cleaner air outside the centre (traffic, heating).
  const withAir = rows.filter((r) => r.air != null);
  if (withAir.length > 50) {
    const rhoA = spearman(withAir.map((r) => km(CENTRE, cellToLatLng(r.h3) as [number, number])), withAir.map((r) => r.air as number));
    add("air quality is not worse at the edge than in the centre (Spearman > -0.3)", rhoA > -0.3, `rho ${rhoA.toFixed(2)}, ${withAir.length} cells`);
  }
  return out;
}
