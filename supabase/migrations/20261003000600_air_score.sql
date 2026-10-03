-- Air quality: one nullable score per cell (null = no station within reach). Facts live in indicators->'air'.
alter table public.hex_scores add column if not exists air_score numeric
  check (air_score is null or (air_score >= 0 and air_score <= 100));
comment on column public.hex_scores.air_score is
  'Cleanliness of the air (PM10 from GIOŚ stations, interpolated), 0–100, higher = cleaner; null = no station within reach. A snapshot of recent days, not an annual figure, and not a verdict on a neighbourhood.';
