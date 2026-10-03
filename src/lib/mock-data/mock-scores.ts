import { cellToLatLng } from "h3-js";
import { KRAKOW_CENTER } from "../h3/config";
import type { Category, CategoryScores } from "../../types";

// Deterministic mock scores. Replace getMockScores() with real data later;
// callers only depend on its signature.

/** Stable 32-bit string hash (FNV-1a). */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pseudo-random value in [0,1) for an integer lattice point. */
function lattice(seed: string, x: number, y: number): number {
  return hash(`${seed}:${x}:${y}`) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth 2D value noise in [0,1] — gives spatially coherent "districts". */
function valueNoise(seed: string, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = lattice(seed, x0, y0);
  const b = lattice(seed, x0 + 1, y0);
  const c = lattice(seed, x0, y0 + 1);
  const d = lattice(seed, x0 + 1, y0 + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// How strongly each category favours the city centre (+1) or the outskirts (-1).
const CENTRALITY: Record<Category, number> = {
  sport: 0.1,
  culture: 0.85,
  greenery: -0.6,
  shopping: 0.55,
  transport: 0.7,
};

export function getMockScores(h3Index: string): CategoryScores {
  const [lat, lng] = cellToLatLng(h3Index);
  // Distance from centre in km (approximate), normalised so ~9 km → 1.
  const dx = (lng - KRAKOW_CENTER.lng) * 71;
  const dy = (lat - KRAKOW_CENTER.lat) * 111;
  const central = 1 - Math.min(1, Math.hypot(dx, dy) / 9); // 1 at centre, 0 at edge

  const scores = {} as CategoryScores;
  for (const category of Object.keys(CENTRALITY) as Category[]) {
    const coarse = valueNoise(category, lng * 90, lat * 130);
    const fine = lattice(category, hash(h3Index) % 9973, 7);
    const bias = CENTRALITY[category] * (central - 0.5); // [-0.5, 0.5] * weight
    scores[category] = clamp(100 * (0.15 + 0.6 * coarse + 0.1 * fine + 0.5 * bias + 0.15));
  }
  return scores;
}
