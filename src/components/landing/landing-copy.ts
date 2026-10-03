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

/** Static class names per category (Tailwind needs full strings); palette: bark / sage / moss / cream. */
export const CATEGORY_STYLE: Record<
  Category,
  { tile: string; fill: string; chip: string; dot: string }
> = {
  sport: {
    tile: "bg-cream border-bark/40 text-bark",
    fill: "bg-bark",
    chip: "bg-cream border-bark/40 text-bark",
    dot: "bg-bark",
  },
  culture: {
    tile: "bg-white border-sage text-bark",
    fill: "bg-sage",
    chip: "bg-white border-sage text-bark",
    dot: "bg-sage",
  },
  greenery: {
    tile: "bg-sage/30 border-moss text-bark",
    fill: "bg-moss",
    chip: "bg-sage/30 border-moss text-bark",
    dot: "bg-moss",
  },
  shopping: {
    tile: "bg-cream border-sage text-bark",
    fill: "bg-sage",
    chip: "bg-cream border-sage text-bark",
    dot: "bg-sage",
  },
  transport: {
    tile: "bg-white border-bark/40 text-bark",
    fill: "bg-bark",
    chip: "bg-white border-bark/40 text-bark",
    dot: "bg-bark",
  },
};
