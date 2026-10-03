-- Safety indicators: one nullable score per cell (null = no data). Facts behind it live in indicators->'safety'.
alter table public.hex_scores add column if not exists safety_score numeric
  check (safety_score is null or (safety_score >= 0 and safety_score <= 100));
comment on column public.hex_scores.safety_score is
  'Share of safety indicators in favour (street lighting from OSM, official crime stats when available), 0–100; null = no data. Not a verdict on a neighbourhood.';
