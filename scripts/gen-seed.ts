// Writes supabase/seed.sql from the deterministic mock scores.
import { writeFileSync } from "node:fs";
import { getHexData } from "../src/lib/mock-data/hexes";

const rows = getHexData().map(
  ({ h3Index: id, scores: s }) =>
    `('${id}',${s.sport},${s.culture},${s.greenery},${s.shopping},${s.transport})`,
);
writeFileSync(
  "supabase/seed.sql",
  `insert into public.hex_scores (h3_index, sport_score, culture_score, greenery_score, shopping_score, transport_score) values\n${rows.join(",\n")}\non conflict (h3_index) do update set sport_score=excluded.sport_score, culture_score=excluded.culture_score, greenery_score=excluded.greenery_score, shopping_score=excluded.shopping_score, transport_score=excluded.transport_score;\n`,
);
console.log(rows.length, "rows");
