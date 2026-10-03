import { CATEGORIES, type Category } from "@/types";
import type { Importance } from "@/lib/scoring/preferences";

/** Importance level picked on the landing page: 1..5 = 20%..100%. */
export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

export const LEVEL_NAMES: Record<Level, string> = {
  1: "Trochę",
  2: "Średnio",
  3: "Ważne",
  4: "Bardzo ważne",
  5: "Kluczowe",
};

export const CATEGORY_PL: Record<Category, { label: string; hint: string }> = {
  sport: { label: "Sport", hint: "Siłownie, boiska, baseny, trasy do biegania" },
  culture: { label: "Kultura", hint: "Muzea, teatry, kina, biblioteki" },
  greenery: { label: "Zieleń", hint: "Parki, ogrody, lasy w pobliżu" },
  shopping: { label: "Zakupy", hint: "Sklepy, supermarkety, centra handlowe" },
  transport: { label: "Transport", hint: "Przystanki i połączenia komunikacji miejskiej" },
};

export const GREETING =
  "Cześć! Jestem Twoim przewodnikiem po Krakowie. Opowiedz mi, jak lubisz spędzać czas i czego szukasz w okolicy — pokażę, które części miasta pasują do Ciebie.";

export const SUGGESTIONS = [
  "Jestem aktywną osobą",
  "Mam rodzinę z dziećmi",
  "Kocham parki i bieganie",
  "Nie mam samochodu",
  "Lubię teatr i muzea",
  "Pracuję zdalnie i cenię ciszę",
  "Często robię zakupy",
  "Do pracy jeżdżę tramwajem",
  "Mam psa i dużo spaceruję",
  "Studiuję i lubię życie nocne",
] as const;

export const SUGGESTIONS_VISIBLE = 4;

export type Levels = Partial<Record<Category, Level>>;

export function levelToPercent(level: Level): number {
  return level * 20;
}

/** Maps a 0–100 importance (query string / LLM) to a landing level; 0 means "not chosen". */
export function importanceToLevel(value: number): Level | null {
  if (value <= 0) return null;
  return Math.min(5, Math.max(1, Math.round(value / 20))) as Level;
}

export function levelsFromImportance(importance: Importance): Levels {
  const out: Levels = {};
  for (const c of CATEGORIES) {
    const level = importanceToLevel(importance[c]);
    if (level) out[c] = level;
  }
  return out;
}

/** Categories without a chosen level get 0, so the map reflects only what the user picked. */
export function levelsToImportance(levels: Levels): Importance {
  const out = {} as Importance;
  for (const c of CATEGORIES) out[c] = levels[c] ? levelToPercent(levels[c]) : 0;
  return out;
}

/** Static class names per category (Tailwind needs full strings). */
export const CATEGORY_STYLE: Record<
  Category,
  { tile: string; fill: string; chip: string; dot: string }
> = {
  sport: {
    tile: "bg-orange-100 border-orange-300 text-orange-900",
    fill: "bg-orange-500",
    chip: "bg-orange-100 border-orange-300 text-orange-950",
    dot: "bg-orange-500",
  },
  culture: {
    tile: "bg-violet-100 border-violet-300 text-violet-900",
    fill: "bg-violet-500",
    chip: "bg-violet-100 border-violet-300 text-violet-950",
    dot: "bg-violet-500",
  },
  greenery: {
    tile: "bg-emerald-100 border-emerald-300 text-emerald-900",
    fill: "bg-emerald-500",
    chip: "bg-emerald-100 border-emerald-300 text-emerald-950",
    dot: "bg-emerald-500",
  },
  shopping: {
    tile: "bg-pink-100 border-pink-300 text-pink-900",
    fill: "bg-pink-500",
    chip: "bg-pink-100 border-pink-300 text-pink-950",
    dot: "bg-pink-500",
  },
  transport: {
    tile: "bg-sky-100 border-sky-300 text-sky-900",
    fill: "bg-sky-500",
    chip: "bg-sky-100 border-sky-300 text-sky-950",
    dot: "bg-sky-500",
  },
};
