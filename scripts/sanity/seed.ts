// Reads the committed seed (supabase/seed.sql) back into plain rows, so scores can be checked without a database.
import { readFileSync } from "node:fs";

export const CATS = ["sport", "culture", "greenery", "shopping", "transport", "education"] as const;
export type Cat = (typeof CATS)[number];

export type SeedRow = {
  h3: string;
  scores: Record<Cat, number>;
  safety: number | null;
  air: number | null;
  district: string | null;
};

const ROW =
  /^\('(\w+)',ST_GeomFromText\('[^']*',4326\),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),'\{[^']*\}'::jsonb,(null|\d+),(null|\d+),(null|'[^']*'),/;

export function readSeed(file = "supabase/seed.sql"): SeedRow[] {
  const rows: SeedRow[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = ROW.exec(line);
    if (!m) continue;
    const [, h3, sport, culture, greenery, shopping, transport, education, safety, air, district] = m;
    rows.push({
      h3,
      scores: {
        sport: +sport,
        culture: +culture,
        greenery: +greenery,
        shopping: +shopping,
        transport: +transport,
        education: +education,
      },
      safety: safety === "null" ? null : +safety,
      air: air === "null" ? null : +air,
      district: district === "null" ? null : district.slice(1, -1),
    });
  }
  return rows;
}
