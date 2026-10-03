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

export const GREETING = "Cześć! Powiedz, czego szukasz w okolicy, a pokażę dopasowane części Krakowa.";

export const SUGGESTIONS = [
  "Aktywny tryb życia",
  "Rodzina z dziećmi",
  "Parki i bieganie",
  "Bez samochodu",
  "Teatr i muzea",
  "Cisza i praca zdalna",
  "Częste zakupy",
  "Jeżdżę tramwajem",
  "Mam psa",
  "Życie nocne",
] as const;

export const SUGGESTIONS_VISIBLE = 3;

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

/** Static class names per category (Tailwind needs full strings); palette: ink glass with one hue per category. */
export const CATEGORY_STYLE: Record<
  Category,
  { tile: string; fill: string; chip: string; dot: string }
> = {
  sport: { tile: "bg-ink/70 border-sun text-mist", fill: "bg-sun", chip: "bg-white/10 border-sun/70 text-mist", dot: "bg-sun" },
  culture: { tile: "bg-ink/70 border-rose text-mist", fill: "bg-rose", chip: "bg-white/10 border-rose/70 text-mist", dot: "bg-rose" },
  greenery: { tile: "bg-ink/70 border-mint text-mist", fill: "bg-mint", chip: "bg-white/10 border-mint/70 text-mist", dot: "bg-mint" },
  shopping: { tile: "bg-ink/70 border-sky text-mist", fill: "bg-sky", chip: "bg-white/10 border-sky/70 text-mist", dot: "bg-sky" },
  transport: { tile: "bg-ink/70 border-lilac text-mist", fill: "bg-lilac", chip: "bg-white/10 border-lilac/70 text-mist", dot: "bg-lilac" },
};
