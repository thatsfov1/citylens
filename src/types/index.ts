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

export type HexData = {
  h3Index: string;
  scores: CategoryScores;
};

export type MapMode = "forYou" | Category;

export const CATEGORY_LABELS: Record<Category, string> = {
  sport: "Sport",
  culture: "Culture",
  greenery: "Greenery",
  shopping: "Shopping",
  transport: "Transport",
};
