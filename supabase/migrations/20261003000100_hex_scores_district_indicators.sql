alter table public.hex_scores
  add column if not exists district text,
  add column if not exists indicators jsonb;

comment on column public.hex_scores.district is 'OSM administrative district (admin_level 9) containing the hex centre';
comment on column public.hex_scores.indicators is 'Per-category raw values and nearest-feature facts backing the scores (explainability)';
