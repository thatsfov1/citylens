import { z } from "zod";
import raw from "./works-map.json";

// Map-wide works layer for the timeline. Built from the same verified records as the database seed by
// scripts/works/build.ts, so it is as reliable as the seed and needs no live query.

const props = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["road", "tram", "rail", "building", "green", "utility", "other"]),
  status: z.enum(["ongoing", "planned", "decision"]),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  whenLabel: z.string().nullable(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  publishedAt: z.string().nullable(),
});

const collection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.object({ type: z.literal("Feature"), properties: props, geometry: z.custom<GeoJSON.Geometry>() })),
});

export type WorksCollection = z.infer<typeof collection>;

let cached: WorksCollection | null = null;
/** Validated once per server instance. */
export function loadWorksMap(): WorksCollection {
  return (cached ??= collection.parse(raw));
}
