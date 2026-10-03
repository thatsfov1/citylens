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
  /**
   * Safety indicators, 0–100 (higher = more indicators in favour). null/absent = no data for this cell.
   * Not a category: it is used as a minimum-level filter, never in the weighted score.
   */
  safety?: number | null;
};

export type MapMode = "forYou" | Category | "safety";

export const CATEGORY_LABELS: Record<Category, string> = {
  sport: "Sport",
  culture: "Culture",
  greenery: "Greenery",
  shopping: "Shopping",
  transport: "Transport",
};

/** An OSM place behind a score, shown as a pin when a hexagon is opened. */
export type PlaceCategory = Exclude<Category, "greenery">;

export type Place = {
  id: number;
  category: PlaceCategory;
  kind: string;
  name: string | null;
  lng: number;
  lat: number;
  /** Metres from the hexagon centre. */
  distanceM: number;
};

export type PlacesResponse = {
  places: Place[];
  /** Park / forest outlines near the hexagon (properties: name, areaHa). */
  green: GeoJSON.FeatureCollection;
};
