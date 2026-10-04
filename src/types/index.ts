export const CATEGORIES = [
  "sport",
  "culture",
  "greenery",
  "shopping",
  "transport",
  "education",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Life stages inside the education category; the user picks which ones matter. */
export const EDUCATION_STAGES = ["kindergarten", "primary", "secondary", "university"] as const;
export type EducationStage = (typeof EDUCATION_STAGES)[number];
export type EducationStageScores = Record<EducationStage, number>;

export const EDUCATION_STAGE_LABELS: Record<EducationStage, string> = {
  kindergarten: "Przedszkole",
  primary: "Szkoła podstawowa",
  secondary: "Szkoła średnia",
  university: "Uczelnia",
};

export type CategoryScores = Record<Category, number>;
export type CategoryWeights = Record<Category, number>;

/** Facts behind each category score (see src/lib/data/score-hex.ts). */
export type { CellIndicators as HexIndicators } from "../lib/data/score-hex";

export type HexData = {
  h3Index: string;
  scores: CategoryScores;
  /**
   * Access score (0–100) per education stage. `scores.education` is their mean; the client recomputes it for the
   * stages the user selected (src/lib/scoring/education.ts). Absent for mock data.
   */
  educationStages?: EducationStageScores;
  /** OSM district containing the cell centre; absent for mock data. */
  district?: string | null;
  /**
   * Safety indicators, 0–100 (higher = more indicators in favour). null/absent = no data for this cell.
   * Not a category: it is used as a minimum-level filter, never in the weighted score.
   */
  safety?: number | null;
  /**
   * Air quality, 0–100 (higher = cleaner), interpolated from a few stations. null/absent = no station in reach.
   * Not a category: shown only in the area panel, never on the map or in the weighted score.
   */
  air?: number | null;
};

export type MapMode = "forYou" | Category | "safety";

export const CATEGORY_LABELS: Record<Category, string> = {
  sport: "Sport",
  culture: "Kultura",
  greenery: "Zieleń",
  shopping: "Zakupy",
  transport: "Transport",
  education: "Edukacja",
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

/** A construction / renovation work (or an investment-related permit) near a hexagon, with its source. */
export type WorkKind = "road" | "tram" | "rail" | "building" | "green" | "utility" | "other";
/** ongoing = in progress; planned = announced for later; decision = permit issued, no works schedule published. */
export type WorkStatus = "ongoing" | "planned" | "decision";

export type WorkNearby = {
  id: number;
  title: string;
  kind: WorkKind;
  status: WorkStatus;
  /** ISO dates (YYYY-MM-DD), only when the source states them. */
  dateFrom: string | null;
  dateTo: string | null;
  /** Reviewed English wording for vague timing, e.g. "around mid-2027". */
  whenLabel: string | null;
  sourceName: string;
  sourceUrl: string;
  /** When the source page / record was published or issued (ISO date). */
  publishedAt: string | null;
  /** Metres from the hexagon centre to the closest part of the works. */
  distanceM: number;
};

/** Properties of one feature in the map-wide works layer (`GET /api/works`): a work without its distance. */
export type WorkFeatureProps = Omit<WorkNearby, "id" | "distanceM"> & { id: string };
