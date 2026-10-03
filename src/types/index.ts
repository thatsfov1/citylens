export const CATEGORIES = [
  "sport",
  "culture",
  "greenery",
  "shopping",
  "transport",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type CategoryScores = Record<Category, number>;
export type CategoryWeights = Record<Category, number>;

/** Facts behind each category score (see src/lib/data/score-hex.ts). */
export type { CellIndicators as HexIndicators } from "../lib/data/score-hex";

export type HexData = {
  h3Index: string;
  scores: CategoryScores;
  /** OSM district containing the cell centre; absent for mock data. */
  district?: string | null;
};

export type MapMode = "forYou" | Category;

export const CATEGORY_LABELS: Record<Category, string> = {
  sport: "Sport",
  culture: "Culture",
  greenery: "Greenery",
  shopping: "Shopping",
  transport: "Transport",
};
