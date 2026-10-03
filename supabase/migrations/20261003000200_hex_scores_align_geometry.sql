-- Aligns a database created from an earlier hex_scores draft (smallint scores, no geometry)
-- with 20261003000000_hex_scores.sql. No-op on a fresh database.
create extension if not exists postgis;

alter table public.hex_scores
  add column if not exists geometry geometry(Polygon, 4326),
  alter column sport_score type numeric,
  alter column culture_score type numeric,
  alter column greenery_score type numeric,
  alter column shopping_score type numeric,
  alter column transport_score type numeric;

create index if not exists hex_scores_geometry_idx
  on public.hex_scores using gist (geometry);
