-- Health and everyday-services access: one score per cell. Facts live in indicators->'health'.
alter table public.hex_scores add column if not exists health_score numeric
  check (health_score is null or (health_score >= 0 and health_score <= 100));
comment on column public.hex_scores.health_score is
  'Access to pharmacies, doctors/clinics, hospitals, post offices and banks mapped in OpenStreetMap, 0–100 (percentile among cells, weighted mean); information only, never in the weighted match score; not a verdict on a neighbourhood and not about quality or opening hours.';
