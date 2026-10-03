create extension if not exists postgis;

create table if not exists public.hex_scores (
  h3_index        text primary key,
  geometry        geometry(Polygon, 4326),
  sport_score     numeric not null check (sport_score     between 0 and 100),
  culture_score   numeric not null check (culture_score   between 0 and 100),
  greenery_score  numeric not null check (greenery_score  between 0 and 100),
  shopping_score  numeric not null check (shopping_score  between 0 and 100),
  transport_score numeric not null check (transport_score between 0 and 100)
);

create index if not exists hex_scores_geometry_idx
  on public.hex_scores using gist (geometry);

-- Public read-only; writes happen only with the service role (bypasses RLS).
alter table public.hex_scores enable row level security;

drop policy if exists "hex_scores are publicly readable" on public.hex_scores;
create policy "hex_scores are publicly readable"
  on public.hex_scores for select
  to anon, authenticated
  using (true);
